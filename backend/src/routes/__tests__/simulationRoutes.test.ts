import request from 'supertest';

/**
 * Route-level tests for simulation endpoints (/simulations/*).
 *
 * SCOPE / IMPACT: mocks the *service* layer, so it verifies the Express layer only —
 * routing, HTTP status codes, request-body validation, the teacher-only authorization
 * guard on results, and request→service wiring. It does NOT verify Supabase SQL; the
 * service SQL is covered by simulationService.integration.test.ts against a real DB.
 *
 * Auth middleware needs real JWT verify/generate, so authService keeps its real token
 * functions (requireActual) while its DB-touching functions are mocked.
 */

jest.mock('../../services/authService', () => {
  const actual = jest.requireActual('../../services/authService');
  return { ...actual, getUserById: jest.fn() };
});

jest.mock('../../services/simulationService', () => ({
  saveSimulationProgress: jest.fn(),
  getSimulationProgress: jest.fn(),
  completeSimulation: jest.fn(),
  getProjectResults: jest.fn(),
  getUserProjectResults: jest.fn(),
}));

jest.mock('../../services/projectService', () => ({
  getProjectById: jest.fn(),
}));

import { app } from '../../app';
import { generateToken } from '../../services/authService';
import * as simulationService from '../../services/simulationService';
import * as projectService from '../../services/projectService';

const OWNER = 'owner-1';
const OTHER = 'other-2';
const ownerToken = generateToken(OWNER);
const otherToken = generateToken(OTHER);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => jest.clearAllMocks());

describe('POST /simulations/:projectId/progress', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/simulations/p1/progress').send({ state: { a: 1 } });
    expect(res.status).toBe(401);
  });

  it('returns 400 when state is missing', async () => {
    const res = await request(app).post('/simulations/p1/progress').set(bearer(ownerToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/state is required/i);
  });

  it('saves progress and returns it (200), forwarding the caller as user_id', async () => {
    (simulationService.saveSimulationProgress as jest.Mock).mockResolvedValue({ id: 'sp1', state: { a: 1 } });
    const res = await request(app).post('/simulations/p1/progress').set(bearer(ownerToken)).send({ state: { a: 1 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'sp1' });
    expect(simulationService.saveSimulationProgress).toHaveBeenCalledWith('p1', OWNER, { a: 1 });
  });
});

describe('GET /simulations/:projectId/progress', () => {
  it('returns the caller\u2019s saved progress', async () => {
    (simulationService.getSimulationProgress as jest.Mock).mockResolvedValue({ id: 'sp1' });
    const res = await request(app).get('/simulations/p1/progress').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(simulationService.getSimulationProgress).toHaveBeenCalledWith('p1', OWNER);
  });
});

describe('POST /simulations/:projectId/complete', () => {
  it('returns 400 when finalState is missing', async () => {
    const res = await request(app).post('/simulations/p1/complete').set(bearer(ownerToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/final state is required/i);
  });

  it('records a completion and returns 201', async () => {
    (simulationService.completeSimulation as jest.Mock).mockResolvedValue({ id: 'r1' });
    const res = await request(app).post('/simulations/p1/complete').set(bearer(ownerToken)).send({ finalState: { x: 1 } });
    expect(res.status).toBe(201);
    expect(simulationService.completeSimulation).toHaveBeenCalledWith('p1', OWNER, { x: 1 });
  });
});

describe('GET /simulations/:projectId/results (teacher-only)', () => {
  it('returns 403 when the caller is not the project creator', async () => {
    (projectService.getProjectById as jest.Mock).mockResolvedValue({ id: 'p1', created_by: OWNER });
    const res = await request(app).get('/simulations/p1/results').set(bearer(otherToken));
    expect(res.status).toBe(403);
    expect(simulationService.getProjectResults).not.toHaveBeenCalled();
  });

  it('returns results when the caller is the project creator', async () => {
    (projectService.getProjectById as jest.Mock).mockResolvedValue({ id: 'p1', created_by: OWNER });
    (simulationService.getProjectResults as jest.Mock).mockResolvedValue([{ id: 'r1' }]);
    const res = await request(app).get('/simulations/p1/results').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(simulationService.getProjectResults).toHaveBeenCalledWith('p1');
  });
});

describe('GET /simulations/:projectId/results/user', () => {
  it('returns the caller\u2019s own results', async () => {
    (simulationService.getUserProjectResults as jest.Mock).mockResolvedValue([{ id: 'r1' }]);
    const res = await request(app).get('/simulations/p1/results/user').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(simulationService.getUserProjectResults).toHaveBeenCalledWith('p1', OWNER);
  });
});
