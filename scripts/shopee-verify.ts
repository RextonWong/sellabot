/**
 * Verifies that signed shop-level Shopee API calls work end-to-end:
 * loads the stored (encrypted) tokens, refreshes them if expired,
 * and calls /api/v2/shop/get_shop_info.
 *
 * Usage: pnpm shopee:verify
 */
import 'dotenv/config';
import { config } from '../src/config';
import db from '../src/db/client';
import { CredentialStore } from '../src/services/credential-store';
import { ShopeeClient } from '../src/platforms/shopee/client';
import { ShopeeAuth } from '../src/platforms/shopee/auth';
import { RateLimiter } from '../src/core/ratelimit';
import { AuthError } from '../src/core/errors';
import { Redis } from 'ioredis';

async function main() {
  const redis = new Redis(config.redisUrl);
  const rateLimiter = new RateLimiter(redis);
  const credStore = new CredentialStore(db);
  const client = new ShopeeClient(config.shopee, rateLimiter);
  const auth = new ShopeeAuth(config.shopee, client);

  const shop = await db.shop.findFirst({ where: { platform: 'shopee', active: true } });
  if (!shop) {
    console.error('No Shopee shop in DB. Run: pnpm shopee:auth');
    process.exit(1);
  }
  console.log(`Shop: ${shop.name} (internal: ${shop.id}, external: ${shop.externalId})`);

  let creds;
  try {
    creds = await credStore.getShopeeCredentials(shop.id);
    console.log('Access token is still valid.');
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
    console.log('Access token expired — refreshing...');
    const { refreshToken, shopExternalId } = await credStore.getRefreshToken(shop.id);
    const tokens = await auth.refreshTokens(refreshToken, shopExternalId);
    await credStore.saveTokens(shop.id, tokens);
    console.log(`✓ Tokens refreshed (new expiry: ${tokens.accessTokenExpiresAt.toISOString()})`);
    creds = await credStore.getShopeeCredentials(shop.id);
  }

  console.log('\nCalling /api/v2/shop/get_shop_info (signed shop-level call)...');
  const info = await client.call<Record<string, unknown>>(
    '/api/v2/shop/get_shop_info',
    'GET',
    creds,
  );

  console.log('\n✓ Signed API call succeeded! Shop info:');
  console.log(JSON.stringify(info, null, 2));

  await redis.quit();
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
