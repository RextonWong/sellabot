import { RetryableError } from './errors';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: true,
};

export function backoffDelayMs(attempt: number, opts: RetryOptions): number {
  const exponential = Math.min(opts.baseDelayMs * 2 ** attempt, opts.maxDelayMs);
  if (!opts.jitter) return exponential;
  // Full jitter: uniform random in [0, exponential]
  return Math.floor(Math.random() * exponential);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!(err instanceof RetryableError)) throw err;
      if (attempt < opts.maxAttempts - 1) {
        const delay = backoffDelayMs(attempt, opts);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
