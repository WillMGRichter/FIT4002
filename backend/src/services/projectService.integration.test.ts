/**
 * Integration tests: real service functions against a REAL Supabase/Postgres.
 *
 * Unlike the route tests (which mock Supabase), these exercise the actual @supabase/supabase-js
 * client against a local Supabase stack, verifying the service-layer SQL matches the committed
 * schema (migrations 001-003): table/column names, FKs, defaults, CHECK constraints, JSONB
 * round-trips, and ordering. This validates SQL/schema correctness (the backend uses the
 * service-role key, so RLS is bypassed and out of scope).
 *
 * SCOPE: student-related paths (student projects/results/state and the attempts RPC) are
 * intentionally EXCLUDED for now — this covers organisations, users, projects, and pages.
 *
 * OPT-IN: runs only when RUN_DB_IT=1 AND SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set.
 * Otherwise the whole suite is skipped, so the default (mocked) test run and CI without a DB
 * are unaffected.
 *
 * To run locally:
 *   npx supabase start
 *   # apply backend/migrations/*.sql to the DB (see README / npm run db:migrate:local)
 *   RUN_DB_IT=1 \
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<secret key from `npx supabase status`> \
 *   npx jest integration
 */

const shouldRun =
  process.env.RUN_DB_IT === '1' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeIt = shouldRun ? describe : describe.skip;

describeIt('service integration (real DB)', () => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const projectService = require('../services/projectService');
  const pageService = require('../services/pageService');
  const authService = require('../services/authService');
  const simulationService = require('../services/simulationService');
  const { supabase } = require('../config/supabase');
  /* eslint-enable @typescript-eslint/no-var-requires */

  // Unique suffix so repeated runs don't collide on UNIQUE(name/username) constraints.
  const tag = `it-${Date.now()}`;
  let orgId: string;
  let userId: string;
  const projectIds: string[] = [];

  beforeAll(async () => {
    orgId = await authService.createOrganisation(`${tag}-org`);
    const { user } = await authService.registerUser(`${tag}-teacher`, 'pw', 'teacher', orgId);
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up in FK-safe order: pages cascade with projects; delete projects, then user, org.
    for (const id of projectIds) {
      try { await projectService.deleteProject(id); } catch { /* ignore */ }
    }
    await supabase.from('users').delete().eq('id', userId);
    await supabase.from('organisations').delete().eq('id', orgId);
  });

  // ── Organisations & users ────────────────────────────────────────────────
  describe('organisations & users', () => {
    it('createOrganisation + listOrganisations round-trips', async () => {
      const orgs = await authService.listOrganisations();
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.some((o: any) => o.id === orgId)).toBe(true);
    });

    it('registerUser persists a user without exposing password_hash and enforces role', async () => {
      const { user, token } = await authService.registerUser(`${tag}-teacher2`, 'pw', 'teacher', orgId);
      expect(user.id).toBeDefined();
      expect(user).not.toHaveProperty('password_hash');
      expect(typeof token).toBe('string');
      // cleanup this extra user
      await supabase.from('users').delete().eq('id', user.id);
    });

    it('registerUser rejects a duplicate username (UNIQUE constraint)', async () => {
      await expect(
        authService.registerUser(`${tag}-teacher`, 'pw', 'teacher', orgId)
      ).rejects.toBeDefined();
    });

    it('registerUser rejects an invalid role (CHECK constraint)', async () => {
      await expect(
        authService.registerUser(`${tag}-badrole`, 'pw', 'wizard', orgId)
      ).rejects.toBeDefined();
    });
  });

  // ── Projects ─────────────────────────────────────────────────────────────
  describe('projects', () => {
    it('createProject applies FKs, the visibility default, and JSONB round-trip', async () => {
      const created = await projectService.createProject('IT Project', userId, orgId, 'desc', { sheets: ['S1'] });
      projectIds.push(created.id);

      expect(created.id).toBeDefined();
      expect(created.name).toBe('IT Project');
      expect(created.created_by).toBe(userId);
      expect(created.organisation_id).toBe(orgId);
      expect(created.visibility).toBe('private'); // schema default
      expect(created.excel_data).toMatchObject({ sheets: ['S1'] }); // JSONB

      const fetched = await projectService.getProjectById(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('updateProject persists changes', async () => {
      const created = await projectService.createProject('To Update', userId, orgId);
      projectIds.push(created.id);

      const updated = await projectService.updateProject(created.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');

      const fetched = await projectService.getProjectById(created.id);
      expect(fetched.name).toBe('Updated Name');
    });

    it('deleteProject removes the row (getProjectById then throws)', async () => {
      const created = await projectService.createProject('To Delete', userId, orgId);
      await projectService.deleteProject(created.id);
      await expect(projectService.getProjectById(created.id)).rejects.toBeDefined();
    });

    it('getProjectsByTeacher returns projects created by the teacher', async () => {
      const created = await projectService.createProject('Teacher Proj', userId, orgId);
      projectIds.push(created.id);
      const projects = await projectService.getProjectsByTeacher(userId);
      expect(projects.some((p: any) => p.id === created.id)).toBe(true);
    });
  });

  // ── Pages ────────────────────────────────────────────────────────────────
  describe('pages', () => {
    let projectId: string;

    beforeAll(async () => {
      const created = await projectService.createProject('Pages Host', userId, orgId);
      projectId = created.id;
      projectIds.push(created.id);
    });

    it('createPage + getPagesByProject returns pages ordered by sort_order', async () => {
      await pageService.createPage(projectId, 'Second', 2);
      await pageService.createPage(projectId, 'First', 1);

      const pages = await pageService.getPagesByProject(projectId);
      const hostPages = pages.filter((p: any) => p.project_id === projectId);
      expect(hostPages.length).toBeGreaterThanOrEqual(2);
      // ordered ascending by sort_order
      const orders = hostPages.map((p: any) => p.sort_order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it('updatePage persists changes', async () => {
      const page = await pageService.createPage(projectId, 'Rename me', 3);
      const updated = await pageService.updatePage(page.id, { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');
    });

    it('deletePage removes the page', async () => {
      const page = await pageService.createPage(projectId, 'Temp', 4);
      await pageService.deletePage(page.id);
      const pages = await pageService.getPagesByProject(projectId);
      expect(pages.some((p: any) => p.id === page.id)).toBe(false);
    });
  });

  // ── Simulation progress & results ──────────────────────────────────────────
  // user_id is a role-agnostic FK to users(id); we seed a teacher-role user as the
  // simulation runner. Rows attach to a project in projectIds and cascade-delete with it.
  describe('simulation service', () => {
    let projectId: string;

    beforeAll(async () => {
      const created = await projectService.createProject('Sim Host', userId, orgId);
      projectId = created.id;
      projectIds.push(created.id);
    });

    it('getSimulationProgress returns null when nothing is saved (PGRST116 path)', async () => {
      const progress = await simulationService.getSimulationProgress(projectId, userId);
      expect(progress).toBeNull();
    });

    it('saveSimulationProgress upserts on (project_id, user_id) — second save updates the same row', async () => {
      const first = await simulationService.saveSimulationProgress(projectId, userId, { step: 1 });
      expect(first.state).toMatchObject({ step: 1 });

      const second = await simulationService.saveSimulationProgress(projectId, userId, { step: 2 });
      // Same row (UNIQUE constraint honoured by upsert), updated state.
      expect(second.id).toBe(first.id);
      expect(second.state).toMatchObject({ step: 2 });

      const fetched = await simulationService.getSimulationProgress(projectId, userId);
      expect(fetched.id).toBe(first.id);
      expect(fetched.state).toMatchObject({ step: 2 });
    });

    it('completeSimulation inserts a result; getProjectResults returns it newest-first', async () => {
      await simulationService.completeSimulation(projectId, userId, { score: 10 });
      await simulationService.completeSimulation(projectId, userId, { score: 20 });

      const results = await simulationService.getProjectResults(projectId);
      expect(results.length).toBeGreaterThanOrEqual(2);
      // ordered by completed_at descending
      const times = results.map((r: any) => new Date(r.completed_at).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('getUserProjectResults returns only the given user\u2019s results', async () => {
      const results = await simulationService.getUserProjectResults(projectId, userId);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((r: any) => r.user_id === userId)).toBe(true);
    });
  });
});
