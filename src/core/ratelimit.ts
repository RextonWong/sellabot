import type { Redis } from 'ioredis';
import { RateLimitError } from './errors';

/**
 * Token-bucket rate limiter backed by Redis.
 * Each (platform, endpoint-class) pair has its own bucket.
 */
export class RateLimiter {
  constructor(private readonly redis: Redis) {}

  /**
   * Acquire a token. Throws RateLimitError if no token available.
   * @param key  e.g. "shopee:product" or "shopee:chat"
   * @param limit  tokens per window
   * @param windowMs  window size in milliseconds
   */
  async acquire(key: string, limit: number, windowMs: number): Promise<void> {
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipe = this.redis.pipeline();
    // Remove tokens older than the window
    pipe.zremrangebyscore(redisKey, '-inf', windowStart);
    // Count tokens in window
    pipe.zcard(redisKey);
    const results = await pipe.exec();

    const count = (results?.[1]?.[1] as number) ?? 0;
    if (count >= limit) {
      // Estimate when the oldest token expires
      const oldest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestMs = oldest[1] ? parseInt(oldest[1], 10) : now;
      const retryAfter = oldestMs + windowMs - now;
      throw new RateLimitError(Math.max(retryAfter, 100));
    }

    // Add this token with current timestamp as score
    await this.redis
      .pipeline()
      .zadd(redisKey, now, `${now}-${Math.random()}`)
      .pexpire(redisKey, windowMs)
      .exec();
  }
}

// Per-platform limits. Shopee v2 typical limits:
// - Most APIs: 1000 req/min per shop
// - Sensitive APIs (price/stock): 100 req/min
export const SHOPEE_LIMITS = {
  default: { limit: 1000, windowMs: 60_000 },
  pricing: { limit: 100, windowMs: 60_000 },
  stock: { limit: 100, windowMs: 60_000 },
  chat: { limit: 200, windowMs: 60_000 },
} as const;
