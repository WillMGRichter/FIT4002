/**
 * Extracts a human-readable message from a caught value.
 *
 * `catch (e)` values are `unknown` in strict TypeScript - anything can be thrown.
 * Here that is usually an `Error` (including the TypeError fetch throws on a
 * network failure), occasionally a string or a plain `{ message }` object.
 * Anything else yields `fallback`, so the UI can always show something.
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
