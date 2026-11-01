import { createSupabaseMock } from './supabaseMock';

const mock = createSupabaseMock();
jest.mock('../../config/supabase', () => ({
  get supabase() {
    return mock.client;
  },
}));

/** Load a fresh copy of authService so its import-time secret check re-runs. */
function loadAuthService(): typeof import('../authService') {
  let loaded!: typeof import('../authService');
  jest.isolateModules(() => {
    loaded = require('../authService');
  });
  return loaded;
}

const ORIGINAL = process.env.JWT_SECRET;

afterEach(() => {
  // Restore the value jest.setup.js provides so other tests are unaffected.
  if (ORIGINAL === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL;
});

describe('authService JWT secret handling', () => {
  it('refuses to load when JWT_SECRET is missing (no silent insecure fallback)', () => {
    delete process.env.JWT_SECRET;
    expect(() => loadAuthService()).toThrow(/Missing JWT_SECRET/);
  });

  it('refuses to load when JWT_SECRET is an empty string', () => {
    process.env.JWT_SECRET = '';
    expect(() => loadAuthService()).toThrow(/Missing JWT_SECRET/);
  });

  it.each([
    'your-secret-key-change-in-prod', // the old hard-coded fallback
    'your_super_secret_key_change_in_prod', // value from IMPLEMENTATION_GUIDE.md
    'my-super-secret-key-please-change', // value from QUICK_START.md
  ])('refuses to load with the known placeholder secret %j', (placeholder) => {
    process.env.JWT_SECRET = placeholder;
    expect(() => loadAuthService()).toThrow(/known placeholder/);
  });

  it('loads and round-trips a token when a real secret is set', () => {
    process.env.JWT_SECRET = 'a-real-random-secret-value';
    const auth = loadAuthService();
    expect(auth.verifyToken(auth.generateToken('user-123'))).toBe('user-123');
  });

  it('rejects a token signed with a different secret', () => {
    process.env.JWT_SECRET = 'secret-one';
    const signer = loadAuthService();
    const token = signer.generateToken('user-123');

    process.env.JWT_SECRET = 'secret-two';
    const verifier = loadAuthService();
    expect(verifier.verifyToken(token)).toBeNull();
  });

  it('rejects a token forged with the old public fallback secret', () => {
    process.env.JWT_SECRET = 'a-real-random-secret-value';
    const auth = loadAuthService();
    // Anyone could mint this before the fix, because the fallback was in the repo.
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ userId: 'attacker-chosen-id' }, 'your-secret-key-change-in-prod');
    expect(auth.verifyToken(forged)).toBeNull();
  });
});
