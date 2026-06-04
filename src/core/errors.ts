/**
 * RetryableError: transient failure — queue will retry with backoff.
 * FatalError: permanent failure — no retry, surface to user immediately.
 * NeedsApprovalError: action blocked pending human confirmation.
 */

export class RetryableError extends Error {
  readonly retryable = true as const;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class FatalError extends Error {
  readonly retryable = false as const;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FatalError';
  }
}

export class NeedsApprovalError extends Error {
  constructor(
    public readonly reason: string,
    public readonly proposedAction: unknown,
  ) {
    super(`Needs approval: ${reason}`);
    this.name = 'NeedsApprovalError';
  }
}

export class ValidationError extends FatalError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends FatalError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends RetryableError {
  constructor(
    public readonly retryAfterMs: number,
    message = 'Rate limit hit',
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function classifyError(err: unknown): RetryableError | FatalError {
  if (err instanceof RetryableError || err instanceof FatalError) return err;
  if (err instanceof Error) return new FatalError(err.message, err);
  return new FatalError(String(err));
}
