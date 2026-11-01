import request from 'supertest';
import XLSX from 'xlsx';
import type { Express } from 'express';

// The app wires every route, which pulls in the Supabase client and services.
// None of these tests need a database, so stub both out.
jest.mock('../config/supabase', () => ({ supabase: {} }));
const mockJoin = jest.fn();
jest.mock('../services/studentJoinService', () => ({
  joinProjectAsStudent: (...args: unknown[]) => mockJoin(...args),
}));

const JOIN_URL = '/public/projects/proj-1/join';
const JOIN_BODY = { displayName: 'Alice', email: 'alice@example.com' };

/**
 * Build a fresh app with the given env. Limits and the rate-limit store are read /
 * created at import time, so each scenario loads its own isolated module graph.
 */
function loadApp(env: Record<string, string | undefined> = {}): Express {
  const keys = ['JOIN_RATE_LIMIT_MAX', 'JOIN_RATE_LIMIT_WINDOW_MS', 'TRUST_PROXY', 'MAX_UPLOAD_MB'];
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
  const workbookBuffer = (): Buffer => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1, 2, { f: 'A1+B1' }]]), 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('rejects a file over the limit with 413 and a clear message (not a 500)', async () => {
    const app = loadApp({ MAX_UPLOAD_MB: '0.01' }); // ~10 KB
    const res = await request(app).post('/excel/upload').attach('file', Buffer.alloc(50 * 1024), 'big.xlsx');

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/file too large/i);
    expect(res.body.error).toContain('0.01 MB');
  });

  it('still accepts a normal workbook under the limit', async () => {
    const app = loadApp({ MAX_UPLOAD_MB: '1' });
    const res = await request(app).post('/excel/upload').attach('file', workbookBuffer(), 'ok.xlsx');

    expect(res.status).toBe(200);
    expect(res.body[0].sheet).toBe('Sheet1');
  });

  it('rejects more than one file in a single request with a 400', async () => {
    const app = loadApp();
    const res = await request(app)
      .post('/excel/upload')
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
