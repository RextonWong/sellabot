import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { ShopeeCredentials } from '../platforms/shopee/client';
import { AuthError } from '../core/errors';
import { config } from '../config';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export class CredentialStore {
  private readonly encKey: Buffer;

  constructor(private readonly db: PrismaClient) {
    this.encKey = Buffer.from(config.encryptionKey, 'base64');
  }

  async getShopeeCredentials(shopId: string): Promise<ShopeeCredentials> {
    const cred = await this.db.shopCredential.findUnique({
      where: { shopId },
      include: { shop: true },
    });

    if (!cred) {
      throw new AuthError(`No credentials found for shop ${shopId}. Run: pnpm shopee:auth`);
    }

    const tokens = this.decrypt(cred.encryptedTokens);

    // Warn if close to expiry (< 5 minutes) but still usable
    const expiresIn = cred.accessTokenExpiresAt.getTime() - Date.now();
    if (expiresIn < 0) {
      throw new AuthError(`Access token expired for shop ${shopId}. Token refresher should have handled this.`);
    }

    return {
      accessToken: tokens.accessToken,
      shopId: Number(cred.shop.externalId),
    };
  }

  async getRefreshToken(shopId: string): Promise<{ refreshToken: string; shopExternalId: number }> {
    const cred = await this.db.shopCredential.findUnique({
      where: { shopId },
      include: { shop: true },
    });
    if (!cred) throw new AuthError(`No credentials for shop ${shopId}`);

    const tokens = this.decrypt(cred.encryptedTokens);
    return { refreshToken: tokens.refreshToken, shopExternalId: Number(cred.shop.externalId) };
  }

  async saveTokens(
    shopId: string,
    tokens: { accessToken: string; refreshToken: string; accessTokenExpiresAt: Date },
  ): Promise<void> {
    const encrypted = this.encrypt({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await this.db.shopCredential.upsert({
      where: { shopId },
      create: {
        shopId,
        encryptedTokens: encrypted,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      },
      update: {
        encryptedTokens: encrypted,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      },
    });
  }

  async listExpiringSoon(withinMs = 10 * 60 * 1000): Promise<string[]> {
    const threshold = new Date(Date.now() + withinMs);
    const creds = await this.db.shopCredential.findMany({
      where: { accessTokenExpiresAt: { lte: threshold } },
      select: { shopId: true },
    });
    return creds.map((c: { shopId: string }) => c.shopId);
  }

  private encrypt(data: StoredTokens): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(raw: string): StoredTokens {
    const buf = Buffer.from(raw, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as StoredTokens;
  }
}
