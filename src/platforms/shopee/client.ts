import axios, { type AxiosInstance } from 'axios';
import { sign, buildCommonParams } from './signer';
import { RetryableError, FatalError, RateLimitError } from '../../core/errors';
import type { RateLimiter } from '../../core/ratelimit';
import { SHOPEE_LIMITS } from '../../core/ratelimit';
import type { Config } from '../../config';

// Note: open.sandbox.test-stable.shopee.com only serves the browser auth
// pages — API calls 404 there. The sandbox API host is the .sg one below
// (per the official docs' GetAccessToken examples).
const HOSTS = {
  live: 'https://partner.shopeemobile.com',
  test: 'https://openplatform.sandbox.test-stable.shopee.sg',
} as const;

export interface ShopeeCredentials {
  accessToken: string;
  shopId: number;
}

export class ShopeeClient {
  private readonly http: AxiosInstance;
  private readonly partnerId: number;
  private readonly partnerKey: string;

  constructor(
    shopeeConfig: Config['shopee'],
    private readonly rateLimiter: RateLimiter,
  ) {
    this.partnerId = shopeeConfig.partnerId;
    this.partnerKey = shopeeConfig.partnerKey;

    this.http = axios.create({
      baseURL: HOSTS[shopeeConfig.env],
      timeout: 15_000,
    });
  }

  /** Make an authenticated shop-level API call. */
  async call<T>(
    path: string,
    method: 'GET' | 'POST',
    creds: ShopeeCredentials,
    data?: unknown,
    limitKey: keyof typeof SHOPEE_LIMITS = 'default',
  ): Promise<T> {
    const limit = SHOPEE_LIMITS[limitKey];
    await this.rateLimiter.acquire(`shopee:${limitKey}`, limit.limit, limit.windowMs);

    const timestamp = Math.floor(Date.now() / 1000);
    const commonParams = buildCommonParams({
      partnerId: this.partnerId,
      partnerKey: this.partnerKey,
      path,
      timestamp,
      accessToken: creds.accessToken,
      shopId: creds.shopId,
    });

    try {
      const response =
        method === 'GET'
          ? await this.http.get(path, { params: { ...commonParams, ...(data as Record<string, unknown> | undefined) } })
          : await this.http.post(path, data, { params: commonParams });

      const body = response.data as ShopeeResponse<T>;

      if (body.error) {
        return this.handleShopeeError(body.error, body.message ?? '');
      }

      // Some endpoints (e.g. shop/get_shop_info) return their payload at the
      // top level instead of nested under `response`.
      return (body.response ?? body) as T;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429 || status === 503) {
          throw new RateLimitError(5_000, `Shopee ${status}: ${err.message}`);
        }
        if (status && status >= 500) {
          throw new RetryableError(`Shopee ${status}: ${err.message}`, err);
        }
        throw new FatalError(`Shopee request failed: ${err.message}`, err);
      }
      throw err;
    }
  }

  /** Make a public (partner-level, no shop auth) API call. */
  async callPublic<T>(
    path: string,
    method: 'GET' | 'POST',
    data?: unknown,
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign({
      partnerId: this.partnerId,
      partnerKey: this.partnerKey,
      path,
      timestamp,
    });

    const params = {
      partner_id: this.partnerId,
      timestamp,
      sign: signature,
    };

    const response =
      method === 'GET'
        ? await this.http.get(path, { params })
        : await this.http.post(path, data, { params });

    const body = response.data as ShopeeResponse<T>;
    if (body.error) {
      return this.handleShopeeError(body.error, body.message ?? '');
    }
    // Auth endpoints (token/get, access_token/get) return their payload at the
    // top level instead of nested under `response`.
    return (body.response ?? body) as T;
  }

  private handleShopeeError(error: string, message: string): never {
    const retryableCodes = ['error_server', 'error_busy', 'error_timeout'];
    if (retryableCodes.includes(error)) {
      throw new RetryableError(`Shopee error ${error}: ${message}`);
    }
    if (error === 'error_auth') {
      throw new FatalError(`Shopee auth error: ${message}`);
    }
    throw new FatalError(`Shopee error ${error}: ${message}`);
  }
}

interface ShopeeResponse<T> {
  error?: string;
  message?: string;
  response?: T;
  warning?: string;
  request_id?: string;
}
