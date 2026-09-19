import request from 'supertest';

// The Supabase client is a chained query builder:
//   supabase.from(t).select(c).eq(k,v).single()
//   supabase.from(t).insert([...]).select().single()
//   supabase.from(t).select(c).order(c)
// We mock it with a builder whose terminal calls (single/order) resolve to a queued result.
// Tests push results via __queue; each terminal call shifts the next one.
const resultQueue: any[] = [];

function makeBuilder() {
  const builder: any = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => nextResult()),
    single: jest.fn(() => nextResult()),
  };
  return builder;
}

function nextResult() {
  // Default to an empty/no-error result if a test forgot to queue one.
  return Promise.resolve(resultQueue.shift() ?? { data: null, error: null });
}

const mockFrom = jest.fn((_table: string) => makeBuilder());

jest.mock('../../config/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// Import AFTER the mock is registered.
import { app } from '../../app';
import { hashPassword, generateToken } from '../../services/authService';

function queue(...results: any[]) {
  resultQueue.push(...results);
}

beforeEach(() => {
  resultQueue.length = 0;
  jest.clearAllMocks();
});

describe('POST /auth/login', () => {
  it('rejects a request missing username or password with 400', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'alice' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 401 when the user does not exist', async () => {
    queue({ data: null, error: { message: 'not found' } }); // users select .single()
    const res = await request(app).post('/auth/login').send({ username: 'ghost', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 401 on wrong password', async () => {
    const password_hash = await hashPassword('correct-password');
    queue({ data: { id: 'u1', username: 'alice', role: 'teacher', password_hash }, error: null });
    const res = await request(app).post('/auth/login').send({ username: 'alice', password: 'WRONG' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid password/i);
  });

  it('logs in with correct credentials and returns a token + safe user (no password_hash)', async () => {
    const password_hash = await hashPassword('s3cret');
    queue({ data: { id: 'u1', username: 'alice', role: 'teacher', password_hash }, error: null });

    const res = await request(app).post('/auth/login').send({ username: 'alice', password: 's3cret' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ id: 'u1', username: 'alice', role: 'teacher' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });
});

describe('POST /auth/signup', () => {
  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth/signup').send({ username: 'bob' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('rejects an invalid role with 400', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'bob', password: 'pw', role: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid role/i);
  });

  it('rejects a duplicate username with 400', async () => {
    // registerUser first checks for an existing user via select().single()
    queue({ data: { id: 'existing' }, error: null });
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'taken', password: 'pw', role: 'student' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates a user and returns 201 with a token', async () => {
    // 1) existing-user check -> none; 2) insert().select().single() -> new user row
    queue(
      { data: null, error: null },
      { data: { id: 'u2', username: 'newbie', role: 'student', password_hash: 'h' }, error: null }
    );
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'newbie', password: 'pw', role: 'student' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ id: 'u2', username: 'newbie', role: 'student' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });
});

describe('GET /auth/organisations (auth-protected)', () => {
  it('returns 401 without a Bearer token', async () => {
    const res = await request(app).get('/auth/organisations');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authorization/i);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app).get('/auth/organisations').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('returns the organisation list with a valid token', async () => {
    const token = generateToken('user-1');
    const orgs = [
      { id: 'o1', name: 'Acme', created_at: '2024-01-01' },
      { id: 'o2', name: 'Globex', created_at: '2024-01-02' },
    ];
    queue({ data: orgs, error: null }); // organisations select().order()

    const res = await request(app).get('/auth/organisations').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(orgs);
  });
});

describe('health check', () => {
  it('GET / returns a running message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/running/i);
  });
});
