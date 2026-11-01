// Runs before every test file (see jest.config.js `setupFiles`).
//
// authService requires JWT_SECRET at import time and refuses to start without it.
// Tests never need a real secret, so supply a throwaway one here so `npm test`
// works locally and in CI with no extra configuration. A value already present in
// the environment wins, so a real secret is never overwritten.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-not-for-production';
