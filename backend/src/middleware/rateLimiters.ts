import rateLimit from 'express-rate-limit';

/** Parses a positive integer env var, falling back to `fallback` on anything else. */
function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface RateLimitOptions {
  /** Length of the counting window, in milliseconds. */
  windowMs: number;
  /** Maximum requests per client IP within one window. */
  limit: number;
}

/**
 * Limiter for the unauthenticated student join endpoint.
 *
 * Every successful join writes a new `users` row and a `project_participants`
 * row, and the endpoint needs no login, so anyone who learns a project id could
 * otherwise flood the database. Counted per client IP.
 *
 * Defaults (60 joins / 15 min / IP) are sized for a classroom: a whole class
 * behind one shared school/NAT address must still be able to join in one go.
 * Tune with JOIN_RATE_LIMIT_MAX and JOIN_RATE_LIMIT_WINDOW_MS. When running
 * behind a reverse proxy, set TRUST_PROXY so the real client IP is used (see
 * app.ts) - otherwise every user shares the proxy's IP and one limit.
 */
export function createJoinRateLimiter(options?: Partial<RateLimitOptions>) {
  const windowMs =
    options?.windowMs ?? positiveInt(process.env.JOIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const limit = options?.limit ?? positiveInt(process.env.JOIN_RATE_LIMIT_MAX, 60);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // RateLimit / RateLimit-Policy headers
    legacyHeaders: false, // no X-RateLimit-*
    message: { error: 'Too many join attempts. Please wait a few minutes and try again.' },
  });
}

/** Shared instance used by the public join route. */
export const joinRateLimiter = createJoinRateLimiter();
