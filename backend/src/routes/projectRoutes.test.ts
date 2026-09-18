import request from 'supertest';

/**
 * Route-level tests for projects, pages, and student-state.
 *
 * SCOPE / IMPACT: these mock the *service* layer, so they verify the Express layer only —
 * routing, HTTP status codes, ownership/authorization guards, request→service wiring, and
 * (for upload) that the Excel buffer is parsed and passed through. They do NOT verify Supabase
 * SQL/RLS behaviour; that would require integration tests against a real test database.
 *
 * The auth middleware needs real JWT verify/generate, so authService keeps its real token
 * functions (requireActual) while its DB-touching functions are mocked.
 */

// ── Service mocks ──────────────────────────────────────────────────────────────
jest.mock('../services/authService', () => {
  const actual = jest.requireActual('../services/authService');
  return {
    ...actual, // keep real generateToken / verifyToken / hashPassword
    getUserById: jest.fn(),
    registerUser: jest.fn(),
  };
});

jest.mock('../services/projectService', () => ({
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  getProjectsByTeacher: jest.fn(),
  getStudentProjects: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  addProjectParticipant: jest.fn(),
  getProjectParticipants: jest.fn(),
  getProjectParticipantsWithUsernames: jest.fn(),
  removeProjectParticipant: jest.fn(),
}));

jest.mock('../services/pageService', () => ({
  getPagesByProject: jest.fn(),
  getPageById: jest.fn(),
  createPage: jest.fn(),
  updatePage: jest.fn(),
  deletePage: jest.fn(),
  reorderPages: jest.fn(),
}));

jest.mock('../services/studentStateService', () => ({
  getOrCreateState: jest.fn(),
  updateInputValues: jest.fn(),
  updateCurrentPage: jest.fn(),
  completeAttempt: jest.fn(),
  getStudentResults: jest.fn(),
}));

// buildExcelData is unit-tested elsewhere; mock it so the upload test can assert the route
// forwards the parsed result without depending on a real .xlsx fixture.
jest.mock('../excel/excelDataBuilder', () => ({
  buildExcelData: jest.fn(() => ({ cells: {}, sheets: ['Sheet1'], multiSheet: false, inputCells: [], outputCells: [] })),
}));

import { app } from '../app';
import { generateToken } from '../services/authService';
import * as projectService from '../services/projectService';
import * as pageService from '../services/pageService';
import * as studentStateService from '../services/studentStateService';
import * as authService from '../services/authService';
import { buildExcelData } from '../excel/excelDataBuilder';

const OWNER = 'owner-1';
const OTHER = 'other-2';
const ownerToken = generateToken(OWNER);
const otherToken = generateToken(OTHER);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — real logic: upload/parse + create, and ownership authorization guards
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /projects (create + Excel upload) [TIER 1]', () => {
  // IMPACT: guards the "project name required" validation branch.
  it('returns 400 when no project name is provided', async () => {
    const res = await request(app).post('/projects').set(bearer(ownerToken)).field('description', 'x');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  // IMPACT: guards the "user must belong to an organisation" branch.
  it('returns 400 when the user has no organisation', async () => {
    (authService.getUserById as jest.Mock).mockResolvedValue({ id: OWNER, organisation_id: null });
    const res = await request(app).post('/projects').set(bearer(ownerToken)).field('title', 'My Project');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/organisation/i);
  });

  // IMPACT: core feature — an uploaded spreadsheet must be parsed by buildExcelData and the
  // result passed into createProject. This is the highest-value backend route path.
  it('parses an uploaded Excel file and stores the parsed data on the new project', async () => {
    (authService.getUserById as jest.Mock).mockResolvedValue({ id: OWNER, organisation_id: 'org-1' });
    (projectService.createProject as jest.Mock).mockResolvedValue({ id: 'p1', name: 'My Project' });

    const res = await request(app)
      .post('/projects')
      .set(bearer(ownerToken))
      .field('title', 'My Project')
      .attach('file', Buffer.from('fake-xlsx-bytes'), 'model.xlsx');

    expect(res.status).toBe(201);
    // The uploaded buffer was handed to the Excel parser...
    expect(buildExcelData).toHaveBeenCalledTimes(1);
    // ...and the parsed data was passed through to createProject (5th arg = excelData).
    const createArgs = (projectService.createProject as jest.Mock).mock.calls[0];
    expect(createArgs[0]).toBe('My Project');
    expect(createArgs[1]).toBe(OWNER);
    expect(createArgs[4]).toMatchObject({ sheets: ['Sheet1'] });
  });

  // IMPACT: confirms create works without a file (excelData null) — the no-upload path.
  it('creates a project without a file (no Excel parsing)', async () => {
    (authService.getUserById as jest.Mock).mockResolvedValue({ id: OWNER, organisation_id: 'org-1' });
    (projectService.createProject as jest.Mock).mockResolvedValue({ id: 'p2', name: 'No File' });

    const res = await request(app).post('/projects').set(bearer(ownerToken)).field('title', 'No File');

    expect(res.status).toBe(201);
    expect(buildExcelData).not.toHaveBeenCalled();
    expect((projectService.createProject as jest.Mock).mock.calls[0][4]).toBeNull();
  });
});

describe('ownership authorization guards [TIER 1]', () => {
  // Each protected mutation must reject a non-owner with 403 and allow the owner through.
  // IMPACT: these are security guards — a regression here could let one teacher modify or read
  // another teacher's project/results.
  const project = { id: 'p1', created_by: OWNER };

  beforeEach(() => {
    (projectService.getProjectById as jest.Mock).mockResolvedValue(project);
  });

  it('PUT /projects/:id — 403 for non-owner', async () => {
    const res = await request(app).put('/projects/p1').set(bearer(otherToken)).send({ name: 'x' });
    expect(res.status).toBe(403);
    expect(projectService.updateProject).not.toHaveBeenCalled();
  });

  it('PUT /projects/:id — owner allowed', async () => {
    (projectService.updateProject as jest.Mock).mockResolvedValue({ ...project, name: 'x' });
    const res = await request(app).put('/projects/p1').set(bearer(ownerToken)).send({ name: 'x' });
    expect(res.status).toBe(200);
    expect(projectService.updateProject).toHaveBeenCalledWith('p1', { name: 'x' });
  });

  it('DELETE /projects/:id — 403 for non-owner', async () => {
    const res = await request(app).delete('/projects/p1').set(bearer(otherToken));
    expect(res.status).toBe(403);
    expect(projectService.deleteProject).not.toHaveBeenCalled();
  });

  it('POST /projects/:id/participants — 403 for non-owner', async () => {
    const res = await request(app).post('/projects/p1/participants').set(bearer(otherToken)).send({ userId: 'u', role: 'student' });
    expect(res.status).toBe(403);
    expect(projectService.addProjectParticipant).not.toHaveBeenCalled();
  });

  it('DELETE /projects/:id/participants/:userId — 403 for non-owner', async () => {
    const res = await request(app).delete('/projects/p1/participants/u9').set(bearer(otherToken));
    expect(res.status).toBe(403);
    expect(projectService.removeProjectParticipant).not.toHaveBeenCalled();
  });

  it('POST /projects/:id/pages — 403 for non-owner, 201 for owner', async () => {
    const forbidden = await request(app).post('/projects/p1/pages').set(bearer(otherToken)).send({ name: 'P' });
    expect(forbidden.status).toBe(403);

    (pageService.createPage as jest.Mock).mockResolvedValue({ id: 'pg1', name: 'P' });
    const ok = await request(app).post('/projects/p1/pages').set(bearer(ownerToken)).send({ name: 'P' });
    expect(ok.status).toBe(201);
    expect(pageService.createPage).toHaveBeenCalled();
  });

  it('DELETE /projects/:id/pages/:pageId — 403 for non-owner', async () => {
    const res = await request(app).delete('/projects/p1/pages/pg1').set(bearer(otherToken));
    expect(res.status).toBe(403);
    expect(pageService.deletePage).not.toHaveBeenCalled();
  });

  it('GET /student-state/:id/results — 403 for non-owner (teacher-only)', async () => {
    const res = await request(app).get('/student-state/p1/results').set(bearer(otherToken));
    expect(res.status).toBe(403);
    expect(studentStateService.getStudentResults).not.toHaveBeenCalled();
  });

  it('GET /student-state/:id/results — owner receives results', async () => {
    (studentStateService.getStudentResults as jest.Mock).mockResolvedValue([{ studentId: 's1' }]);
    const res = await request(app).get('/student-state/p1/results').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ studentId: 's1' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — thin passthroughs: assert the route mounts, requires auth, and returns
// the service result with the right status code. IMPACT: catches broken route mounts,
// wrong status codes, and missing-auth regressions (but mostly exercises the mock).
// ─────────────────────────────────────────────────────────────────────────────
describe('thin passthrough routes [TIER 2]', () => {
  it('GET /projects/:id returns the project (200)', async () => {
    (projectService.getProjectById as jest.Mock).mockResolvedValue({ id: 'p1', name: 'A' });
    const res = await request(app).get('/projects/p1').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'p1', name: 'A' });
  });

  it('GET /projects/:id returns 404 when the service throws', async () => {
    (projectService.getProjectById as jest.Mock).mockRejectedValue(new Error('nope'));
    const res = await request(app).get('/projects/missing').set(bearer(ownerToken));
    expect(res.status).toBe(404);
  });

  it('GET /projects/teacher/projects returns the teacher list', async () => {
    (projectService.getProjectsByTeacher as jest.Mock).mockResolvedValue([{ id: 'p1' }]);
    const res = await request(app).get('/projects/teacher/projects').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'p1' }]);
  });

  it('GET /projects/student/projects returns the student list', async () => {
    (projectService.getStudentProjects as jest.Mock).mockResolvedValue([{ id: 'p2' }]);
    const res = await request(app).get('/projects/student/projects').set(bearer(otherToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'p2' }]);
  });

  it('GET /projects/:id/pages returns pages', async () => {
    (pageService.getPagesByProject as jest.Mock).mockResolvedValue([{ id: 'pg1' }]);
    const res = await request(app).get('/projects/p1/pages').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'pg1' }]);
  });

  it('GET /projects/:id/pages/:pageId returns a page (200) and 404 on error', async () => {
    (pageService.getPageById as jest.Mock).mockResolvedValue({ id: 'pg1' });
    const ok = await request(app).get('/projects/p1/pages/pg1').set(bearer(ownerToken));
    expect(ok.status).toBe(200);

    (pageService.getPageById as jest.Mock).mockRejectedValue(new Error('x'));
    const missing = await request(app).get('/projects/p1/pages/none').set(bearer(ownerToken));
    expect(missing.status).toBe(404);
  });

  it('GET /student-state/:id/state gets or creates state', async () => {
    (studentStateService.getOrCreateState as jest.Mock).mockResolvedValue({ id: 'st1', attempt_number: 1 });
    const res = await request(app).get('/student-state/p1/state').set(bearer(otherToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'st1' });
    expect(studentStateService.getOrCreateState).toHaveBeenCalledWith('p1', OTHER);
  });

  it('PUT /student-state/:id/state/inputs saves inputs', async () => {
    (studentStateService.updateInputValues as jest.Mock).mockResolvedValue({ id: 'st1' });
    const res = await request(app)
      .put('/student-state/p1/state/inputs')
      .set(bearer(otherToken))
      .send({ stateId: 'st1', inputValues: { A1: 5 } });
    expect(res.status).toBe(200);
    expect(studentStateService.updateInputValues).toHaveBeenCalledWith('st1', { A1: 5 });
  });

  it('POST /student-state/:id/state/complete marks completion', async () => {
    (studentStateService.completeAttempt as jest.Mock).mockResolvedValue(undefined);
    const res = await request(app)
      .post('/student-state/p1/state/complete')
      .set(bearer(otherToken))
      .send({ stateId: 'st1', inputValues: {} });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/completed/i);
  });

  it('requires auth: GET /projects/:id without a token is 401', async () => {
    const res = await request(app).get('/projects/p1');
    expect(res.status).toBe(401);
  });
});
