import type { Config } from '../../config';
import type { ShopeeClient } from './client';

export interface ShopeeTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  shopId: number;
}

export class ShopeeAuth {
  constructor(
    private readonly config: Config['shopee'],
    private readonly client: ShopeeClient,
  ) {}

  /** Build the OAuth authorization URL to redirect the seller to. */
  buildAuthUrl(): string {
    const baseHost =
      this.config.env === 'live'
        ? 'https://open.shopee.com'
        : 'https://open.sandbox.test-stable.shopee.com';

    const params = new URLSearchParams({
      partner_id: String(this.config.partnerId),
      auth_type: 'seller',
      redirect_uri: this.config.redirectUrl,
      response_type: 'code',
    });

    return `${baseHost}/auth?${params.toString()}`;
  }

  /** Exchange an authorization code for tokens. */
  async exchangeCode(code: string, shopId: number): Promise<ShopeeTokens> {
    const path = '/api/v2/auth/token/get';
    const response = await this.client.callPublic<ShopeeTokenResponse>(
      path,
      'POST',
      {
        code,
        shop_id: shopId,
        partner_id: this.config.partnerId,
      },
    );

    return this.mapTokenResponse(response, shopId);
  }

  /** Use a refresh token to get a new access token. */
  async refreshTokens(refreshToken: string, shopId: number): Promise<ShopeeTokens> {
    const path = '/api/v2/auth/access_token/get';
    const response = await this.client.callPublic<ShopeeTokenResponse>(
      path,
      'POST',
      {
        refresh_token: refreshToken,
        shop_id: shopId,
        partner_id: this.config.partnerId,
      },
    );

    return this.mapTokenResponse(response, shopId);
  }

  private mapTokenResponse(response: ShopeeTokenResponse, shopId: number): ShopeeTokens {
    const expiresAt = new Date(Date.now() + response.expire_in * 1000);
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      accessTokenExpiresAt: expiresAt,
      shopId,
    };
  }
}

interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;  // seconds until access_token expires
  shop_id_list?: number[];
}
