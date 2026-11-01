import http from 'http';
import supertest from 'supertest';
import XLSX from 'xlsx';
import type { Express } from 'express';

// The app wires every route, which pulls in the Supabase client and services.
// None of these tests need a database, so stub both out.
jest.mock('../config/supabase', () => ({ supabase: {} }));
const mockJoin = jest.fn();
jest.mock('../services/studentJoinService', () => ({
  joinProjectAsStudent: (...args: unknown[]) => mockJoin(...args),
}));

// Keep the real token functions (the upload tests sign real JWTs) but stub the DB-backed logins.
const mockLoginUser = jest.fn();
const mockLoginStudent = jest.fn();
jest.mock('../services/authService', () => ({
  ...jest.requireActual('../services/authService'),
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
  loginStudent: (...args: unknown[]) => mockLoginStudent(...args),
}));
import { generateToken } from '../services/authService';

// supertest's request(app) listens on a wildcard port. On a dev machine running many other local
// servers (language servers, dev servers, ...) some requests have been seen answered by a
// different process (random 404 / 501 that this app cannot produce). Binding explicitly to
// 127.0.0.1 makes that much rarer (roughly 1 run in 8 -> 1 in 30 on the author's Mac) but does not
// eliminate it; CI on a clean machine is unaffected. If it recurs locally, just re-run.
const servers: http.Server[] = [];
function request(app: Express) {
  const server = http.createServer(app).listen(0, '127.0.0.1');
  servers.push(server);
  return supertest(server);
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
});

const JOIN_URL = '/public/projects/proj-1/join';
const JOIN_BODY = { displayName: 'Alice', email: 'alice@example.com' };

/**
 * Build a fresh app with the given env. Limits and the rate-limit store are read /
 * created at import time, so each scenario loads its own isolated module graph.
 */
function loadApp(env: Record<string, string | undefined> = {}): Express {
  const keys = ['JOIN_RATE_LIMIT_MAX', 'JOIN_RATE_LIMIT_WINDOW_MS', 'TRUST_PROXY', 'MAX_UPLOAD_MB',
    'LOGIN_RATE_LIMIT_MAX', 'LOGIN_IP_RATE_LIMIT_MAX', 'LOGIN_RATE_LIMIT_WINDOW_MS',
    'SIGNUP_RATE_LIMIT_MAX', 'SIGNUP_RATE_LIMIT_WINDOW_MS'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);

  let app!: Express;
  try {
    jest.isolateModules(() => {
      app = require('../app').createApp();
    });
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
  return app;
}

beforeEach(() => {
  mockLoginUser.mockReset();
  mockLoginStudent.mockReset();
  mockJoin.mockReset();
  mockJoin.mockResolvedValue({ token: 't', userId: 'u1', displayName: 'Alice', email: 'a@b.com', maxAttempts: 1 });
});

describe('helmet security headers', () => {
  it('sets hardening headers and hides X-Powered-By', async () => {
    const res = await request(loadApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not break cross-origin API calls from the frontend (CORS still works)', async () => {
    const res = await request(loadApp()).get('/').set('Origin', 'http://192.168.0.252:3002');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('answers a CORS preflight for the join endpoint', async () => {
    const res = await request(loadApp())
      .options(JOIN_URL)
      .set('Origin', 'http://192.168.0.252:3002')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('join endpoint rate limit', () => {
  it('allows requests up to the limit, then answers 429 with a helpful message', async () => {
    const app = loadApp({ JOIN_RATE_LIMIT_MAX: '3' });

    for (let i = 0; i < 3; i++) {
      expect((await request(app).post(JOIN_URL).send(JOIN_BODY)).status).toBe(201);
    }
    const blocked = await request(app).post(JOIN_URL).send(JOIN_BODY);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many join attempts/i);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(mockJoin).toHaveBeenCalledTimes(3); // the blocked request never reached the service
  });

  it('exposes standard RateLimit headers and not the legacy X-RateLimit ones', async () => {
    const res = await request(loadApp({ JOIN_RATE_LIMIT_MAX: '5' })).post(JOIN_URL).send(JOIN_BODY);
    expect(res.headers['ratelimit']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('uses a classroom-sized default (60) when not configured', async () => {
    const res = await request(loadApp()).post(JOIN_URL).send(JOIN_BODY);
    expect(res.headers['ratelimit-policy']).toMatch(/^60;/);
  });

  it('falls back to the default when the env value is invalid', async () => {
    const res = await request(loadApp({ JOIN_RATE_LIMIT_MAX: 'abc' })).post(JOIN_URL).send(JOIN_BODY);
    expect(res.headers['ratelimit-policy']).toMatch(/^60;/);
  });

  it('only limits the join route, not other endpoints', async () => {
    const app = loadApp({ JOIN_RATE_LIMIT_MAX: '1' });
    await request(app).post(JOIN_URL).send(JOIN_BODY);
    expect((await request(app).post(JOIN_URL).send(JOIN_BODY)).status).toBe(429);
    expect((await request(app).get('/')).status).toBe(200);
  });

  it('limits per client IP when behind a trusted proxy (TRUST_PROXY=1)', async () => {
    const app = loadApp({ JOIN_RATE_LIMIT_MAX: '1', TRUST_PROXY: '1' });
    const join = (ip: string) => request(app).post(JOIN_URL).set('X-Forwarded-For', ip).send(JOIN_BODY);

    expect((await join('203.0.113.1')).status).toBe(201);
    expect((await join('203.0.113.1')).status).toBe(429); // same client: blocked
    expect((await join('203.0.113.2')).status).toBe(201); // different client: own allowance
  });

  it('cannot be dodged by spoofing X-Forwarded-For when no proxy is trusted', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // express-rate-limit warns about the header
    const app = loadApp({ JOIN_RATE_LIMIT_MAX: '1' });
    const join = (ip: string) => request(app).post(JOIN_URL).set('X-Forwarded-For', ip).send(JOIN_BODY);

    expect((await join('203.0.113.1')).status).toBe(201);
    expect((await join('203.0.113.2')).status).toBe(429); // a "new" IP gives no fresh allowance
    errorSpy.mockRestore();
  });

  it('refuses a bare TRUST_PROXY=true (it would let clients spoof their IP)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = loadApp({ JOIN_RATE_LIMIT_MAX: '1', TRUST_PROXY: 'true' });
    const join = (ip: string) => request(app).post(JOIN_URL).set('X-Forwarded-For', ip).send(JOIN_BODY);

    expect((await join('203.0.113.1')).status).toBe(201);
    expect((await join('203.0.113.2')).status).toBe(429);
    errorSpy.mockRestore();
  });
});

describe('excel upload size limit', () => {
  const auth = () => ({ Authorization: `Bearer ${generateToken('teacher-1')}` });
  const workbookBuffer = (): Buffer => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1, 2, { f: 'A1+B1' }]]), 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('rejects a file over the limit with 413 and a clear message (not a 500)', async () => {
    const app = loadApp({ MAX_UPLOAD_MB: '0.01' }); // ~10 KB
    const res = await request(app).post('/excel/upload').set(auth()).attach('file', Buffer.alloc(50 * 1024), 'big.xlsx');

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/file too large/i);
    expect(res.body.error).toContain('0.01 MB');
  });

  it('still accepts a normal workbook under the limit', async () => {
    const app = loadApp({ MAX_UPLOAD_MB: '1' });
    const res = await request(app).post('/excel/upload').set(auth()).attach('file', workbookBuffer(), 'ok.xlsx');

    expect(res.status).toBe(200);
    expect(res.body[0].sheet).toBe('Sheet1');
  });

  it('rejects more than one file in a single request with a 400', async () => {
    const app = loadApp();
    const res = await request(app)
      .post('/excel/upload')
      .set(auth())
      .attach('file', workbookBuffer(), 'a.xlsx')
      .attach('file', workbookBuffer(), 'b.xlsx');

    expect(res.status).toBe(400);
  });

  it.each(['abc', '0', '-5', ''])('ignores an invalid MAX_UPLOAD_MB (%j) and keeps the 10 MB default', async (value) => {
    const { MAX_UPLOAD_MB } = (() => {
      const saved = process.env.MAX_UPLOAD_MB;
      process.env.MAX_UPLOAD_MB = value;
      let cfg!: { MAX_UPLOAD_MB: number };
      jest.isolateModules(() => {
        cfg = require('../config/upload');
      });
      if (saved === undefined) delete process.env.MAX_UPLOAD_MB;
      else process.env.MAX_UPLOAD_MB = saved;
      return cfg;
    })();
    expect(MAX_UPLOAD_MB).toBe(10);
  });
});

describe('excel upload authentication', () => {
  const workbook = (): Buffer => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1, 2]]), 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('rejects an upload with no token (401)', async () => {
    const res = await request(loadApp()).post('/excel/upload').attach('file', workbook(), 'a.xlsx');
    expect(res.status).toBe(401);
  });

  it('rejects an upload with an invalid token (401)', async () => {
    const res = await request(loadApp())
      .post('/excel/upload')
      .set('Authorization', 'Bearer not-a-real-token')
      .attach('file', workbook(), 'a.xlsx');
    expect(res.status).toBe(401);
  });

  it('rejects before parsing: an oversized file without a token gets 401, not 413', async () => {
    const app = loadApp({ MAX_UPLOAD_MB: '0.01' });
    const res = await request(app).post('/excel/upload').attach('file', Buffer.alloc(50 * 1024), 'big.xlsx');
    expect(res.status).toBe(401);
  });

  it('accepts an upload with a valid token', async () => {
    const res = await request(loadApp())
      .post('/excel/upload')
      .set('Authorization', `Bearer ${generateToken('teacher-1')}`)
      .attach('file', workbook(), 'a.xlsx');
    expect(res.status).toBe(200);
  });
});

describe('login rate limit', () => {
  const STUDENT = '/auth/login/student';
  const TEACHER = '/auth/login';
  const wrong = new Error('Invalid credentials');

  const studentLogin = (app: Express, username: string, projectId = 'proj-1') =>
    request(app).post(STUDENT).send({ projectId, username, password: 'pw' });
  const teacherLogin = (app: Express, username: string) =>
    request(app).post(TEACHER).send({ username, password: 'pw' });

  it('blocks password guessing on one account after the failure limit, with 429', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '3' });

    for (let i = 0; i < 3; i++) expect((await studentLogin(app, 'alice')).status).toBe(401);
    const blocked = await studentLogin(app, 'alice');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many failed login attempts/i);
    expect(mockLoginStudent).toHaveBeenCalledTimes(3); // the 4th never reached the service
  });

  it('applies the same limit to teacher login', async () => {
    mockLoginUser.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });

    await teacherLogin(app, 'teacher');
    await teacherLogin(app, 'teacher');
    expect((await teacherLogin(app, 'teacher')).status).toBe(429);
  });

  it('does not let one locked-out account block a classmate on the same IP', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });
    await studentLogin(app, 'alice');
    await studentLogin(app, 'alice');
    expect((await studentLogin(app, 'alice')).status).toBe(429);

    mockLoginStudent.mockResolvedValue({ user: { id: 'u2' }, token: 't' });
    expect((await studentLogin(app, 'bob')).status).toBe(200);
  });

  it('treats the account case-insensitively so changing case does not dodge the limit', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });
    await studentLogin(app, 'alice');
    await studentLogin(app, 'ALICE');
    expect((await studentLogin(app, ' Alice ')).status).toBe(429);
  });

  it('scopes student accounts per project', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });
    await studentLogin(app, 'alice', 'proj-1');
    await studentLogin(app, 'alice', 'proj-1');
    expect((await studentLogin(app, 'alice', 'proj-1')).status).toBe(429);
    expect((await studentLogin(app, 'alice', 'proj-2')).status).toBe(401); // different project, own budget
  });

  it('never counts successful logins, so a class logging in at once is not throttled', async () => {
    mockLoginStudent.mockResolvedValue({ user: { id: 'u1' }, token: 't' });
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2', LOGIN_IP_RATE_LIMIT_MAX: '2' });

    for (let i = 0; i < 10; i++) expect((await studentLogin(app, 'alice')).status).toBe(200);
  });

  it('stops one IP spraying many accounts once the per-IP failure limit is hit', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '100', LOGIN_IP_RATE_LIMIT_MAX: '3' });

    for (const name of ['a', 'b', 'c']) expect((await studentLogin(app, name)).status).toBe(401);
    expect((await studentLogin(app, 'd')).status).toBe(429);
  });

  it('cannot be dodged by spoofing X-Forwarded-For when no proxy is trusted', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });
    for (let i = 0; i < 2; i++) await studentLogin(app, 'alice').set('X-Forwarded-For', `1.2.3.${i}`);

    expect((await studentLogin(app, 'alice').set('X-Forwarded-For', '9.9.9.9')).status).toBe(429);
  });

  it('counts a malformed (400) request as a failure and tolerates a missing body', async () => {
    const app = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' });
    expect((await request(app).post(STUDENT).send({})).status).toBe(400);
    expect((await request(app).post(STUDENT).send({})).status).toBe(400);
    expect((await request(app).post(STUDENT).send({})).status).toBe(429);
  });

  it('uses defaults (10 per account) when not configured', async () => {
    mockLoginStudent.mockRejectedValue(wrong);
    const app = loadApp();
    for (let i = 0; i < 10; i++) expect((await studentLogin(app, 'alice')).status).toBe(401);
    expect((await studentLogin(app, 'alice')).status).toBe(429);
  });
});

describe('signup rate limit', () => {
  it('limits unauthenticated signups per IP with 429', async () => {
    const app = loadApp({ SIGNUP_RATE_LIMIT_MAX: '2' });
    const signup = () => request(app).post('/auth/signup').send({});

    expect((await signup()).status).not.toBe(429);
    expect((await signup()).status).not.toBe(429);
    const blocked = await signup();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many sign-up attempts/i);
  });

  it('also covers organisation signup', async () => {
    const app = loadApp({ SIGNUP_RATE_LIMIT_MAX: '1' });
    await request(app).post('/auth/signup/organisation').send({});
    expect((await request(app).post('/auth/signup/organisation').send({})).status).toBe(429);
  });
});
