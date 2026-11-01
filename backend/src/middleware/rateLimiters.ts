import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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

/**
 * Limiters for the unauthenticated login endpoints (/auth/login, /auth/login/student).
 *
 * Without these an attacker can try unlimited passwords. Two layers are used, and both
 * count only FAILED attempts (`skipSuccessfulRequests`), so legitimate logins never use
 * up the budget:
 *
 *  1. Per (client IP + target account): stops guessing one account's password.
 *     Default 10 failures / 15 min. A student who mistypes a few times is fine; a bot
 *     is stopped. Keyed on the account as well as the IP so that one student locking
 *     themselves out never blocks classmates behind the same school/NAT address.
 *  2. Per client IP: stops one address spraying many accounts. Default 100 failures
 *     / 15 min, deliberately higher because a whole class may share one IP.
 *
 * Tune with LOGIN_RATE_LIMIT_MAX, LOGIN_IP_RATE_LIMIT_MAX and LOGIN_RATE_LIMIT_WINDOW_MS.
 * Like the join limiter, this needs TRUST_PROXY set correctly behind a reverse proxy.
 */
export function createLoginRateLimiters(options?: {
  windowMs?: number;
  perAccountLimit?: number;
  perIpLimit?: number;
}) {
  const windowMs =
    options?.windowMs ?? positiveInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const perAccountLimit =
    options?.perAccountLimit ?? positiveInt(process.env.LOGIN_RATE_LIMIT_MAX, 10);
  const perIpLimit =
    options?.perIpLimit ?? positiveInt(process.env.LOGIN_IP_RATE_LIMIT_MAX, 100);

  const common = {
    windowMs,
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed logins (status >= 400) are counted
    message: { error: 'Too many failed login attempts. Please wait a few minutes and try again.' },
  };

  const accountKey = (req: Request): string => {
    const body = (req.body ?? {}) as { username?: unknown; projectId?: unknown };
    const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 200) : '');
    return `${ipKeyGenerator(req.ip ?? '')}|${norm(body.projectId)}|${norm(body.username)}`;
  };

  return {
    perAccount: rateLimit({ ...common, limit: perAccountLimit, keyGenerator: accountKey }),
    perIp: rateLimit({ ...common, limit: perIpLimit, keyGenerator: (req) => ipKeyGenerator(req.ip ?? '') }),
  };
}

const loginLimiters = createLoginRateLimiters();
/** Shared instances used by the login routes: apply both, e.g. `router.post('/login', loginIpRateLimiter, loginAccountRateLimiter, ...)`. */
export const loginIpRateLimiter = loginLimiters.perIp;
export const loginAccountRateLimiter = loginLimiters.perAccount;

/**
 * Limiter for the unauthenticated signup endpoints, which create organisations and
 * user rows. Counts every request (not just failures) per client IP.
 * Default 20 / hour / IP; tune with SIGNUP_RATE_LIMIT_MAX and SIGNUP_RATE_LIMIT_WINDOW_MS.
 */
export function createSignupRateLimiter(options?: Partial<RateLimitOptions>) {
  const windowMs =
    options?.windowMs ?? positiveInt(process.env.SIGNUP_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000);
  const limit = options?.limit ?? positiveInt(process.env.SIGNUP_RATE_LIMIT_MAX, 20);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-up attempts. Please wait and try again later.' },
  });
}

/** Shared instance used by the signup routes. */
export const signupRateLimiter = createSignupRateLimiter();
