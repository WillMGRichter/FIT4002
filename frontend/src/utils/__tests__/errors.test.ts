import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('reads the message of an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads the message of the TypeError fetch throws on a network failure', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('reads the message of a plain { message } object', () => {
    expect(getErrorMessage({ message: 'from server' })).toBe('from server');
  });

  it('passes through a thrown string', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an empty object', {}],
    ['a non-string message', { message: 7 }],
    ['an empty message', { message: '' }],
    ['an Error with an empty message', new Error('')],
  ])('falls back for %s', (_label, value) => {
    expect(getErrorMessage(value)).toBe('An unexpected error occurred');
  });

  it('uses a caller-supplied fallback, but prefers a real message', () => {
    expect(getErrorMessage(undefined, 'Login failed')).toBe('Login failed');
    expect(getErrorMessage(new Error('real'), 'Login failed')).toBe('real');
  });
});
