/**
 * Extracts a human-readable message from a caught value.
 *
 * `catch (e)` values are `unknown` in strict TypeScript - anything can be thrown.
 * In this codebase we see three shapes:
 *   - real `Error` instances,
 *   - Supabase/PostgREST errors, which are plain objects with a `message`
 *     (NOT `Error` instances, so `instanceof Error` alone would miss them),
 *   - bare strings.
 * Anything else yields `fallback`, so callers can always safely send a message.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
