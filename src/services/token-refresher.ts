import type { CredentialStore } from './credential-store';
import type { ShopeeAuth } from '../platforms/shopee/auth';
import type { Logger } from 'pino';

/**
 * Proactively refreshes Shopee access tokens before they expire.
 * Run on a schedule (e.g. every 5 minutes).
 */
export class TokenRefresher {
  constructor(
    private readonly credStore: CredentialStore,
    private readonly shopeeAuth: ShopeeAuth,
    private readonly logger: Logger,
  ) {}

  async refreshExpiring(): Promise<void> {
    const shopIds = await this.credStore.listExpiringSoon(10 * 60 * 1000); // 10 min window

    if (shopIds.length === 0) return;

    this.logger.info({ count: shopIds.length }, 'refreshing expiring tokens');

    await Promise.allSettled(
      shopIds.map((shopId) => this.refreshOne(shopId)),
    );
  }

  private async refreshOne(shopId: string): Promise<void> {
    try {
      const { refreshToken, shopExternalId } = await this.credStore.getRefreshToken(shopId);
      const newTokens = await this.shopeeAuth.refreshTokens(refreshToken, shopExternalId);
      await this.credStore.saveTokens(shopId, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        accessTokenExpiresAt: newTokens.accessTokenExpiresAt,
      });
      this.logger.info({ shopId }, 'token refreshed');
    } catch (err) {
      this.logger.error({ shopId, err }, 'token refresh failed');
    }
  }

  /** Start periodic refresh. Returns a cleanup function. */
  startSchedule(intervalMs = 5 * 60 * 1000): () => void {
    const timer = setInterval(() => void this.refreshExpiring(), intervalMs);
    timer.unref(); // don't block process exit
    return () => clearInterval(timer);
  }
}
