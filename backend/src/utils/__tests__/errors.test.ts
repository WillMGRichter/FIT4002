import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('reads the message of a real Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads the message of an Error subclass', () => {
    class NotFound extends Error {}
    expect(getErrorMessage(new NotFound('missing'))).toBe('missing');
  });

  it('reads the message of a Supabase-style plain-object error (not an Error instance)', () => {
    const supabaseError = { message: 'duplicate key value', code: '23505', details: null };
    expect(getErrorMessage(supabaseError)).toBe('duplicate key value');
  });

  it('passes through a thrown string', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an empty object', {}],
    ['an object with a non-string message', { message: 123 }],
    ['an object with an empty message', { message: '' }],
    ['an Error with an empty message', new Error('')],
    ['an empty string', ''],
  ])('falls back for %s', (_label, value) => {
    expect(getErrorMessage(value)).toBe('An unexpected error occurred');
  });

  it('uses a caller-supplied fallback', () => {
    expect(getErrorMessage(undefined, 'Could not join project')).toBe('Could not join project');
  });

  it('prefers the real message over the fallback', () => {
    expect(getErrorMessage(new Error('real'), 'fallback')).toBe('real');
  });
});
