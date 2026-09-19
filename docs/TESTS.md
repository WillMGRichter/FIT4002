# Test Suite

This document describes every test file in the project: what it covers, why, and how to
run it. Counts are the number of tests actually executed (some suites generate tests
dynamically, so the executed count can exceed the number of literal `it(...)` calls).

## Overview

| Area | File | Tests | Type | DB |
|------|------|------:|------|:--:|
| Formula engine | `frontend/src/utils/__tests__/FormulaEngine.test.ts` | 48 | unit | — |
| Login screen | `frontend/src/pages/__tests__/LoginPage.test.tsx` | 3 | component | — |
| Student simulation screen | `frontend/src/pages/__tests__/StudentSimulationView.test.tsx` | 5 | component | — |
| Excel data builder | `backend/src/excel/__tests__/excelDataBuilder.test.ts` | 12 | unit | — |
| Formula cross-check | `backend/src/excel/__tests__/crossCheck.test.ts` | 21 | unit (oracle) | — |
| Auth routes | `backend/src/routes/__tests__/authRoutes.test.ts` | 12 | route (mocked) | — |
| Project/page/student-state routes | `backend/src/routes/__tests__/projectRoutes.test.ts` | 23 | route (mocked) | — |
| Simulation routes | `backend/src/routes/__tests__/simulationRoutes.test.ts` | 9 | route (mocked) | — |
| Service integration | `backend/src/services/__tests__/projectService.integration.test.ts` | 15 | integration | ✔ |

Totals: **frontend 56**, **backend 77 mocked + 15 integration**.

---

## Frontend

### `FormulaEngine.test.ts` (48)
Unit tests for the spreadsheet formula evaluator (`frontend/src/utils/FormulaEngine.ts`) —
the core logic that recomputes cell values in the simulation.

Covers:
- Arithmetic, operator precedence, parentheses, `^` (power) and unary minus.
- Cell/range references, sheet-qualified refs (`SALES!B3`), and range expansion.
- Aggregate functions `SUM`, `AVERAGE`/`AVG`, `MIN`, `MAX`, `COUNT`, `PRODUCT` — including
  **literal and expression arguments** (e.g. `MAX(0, B8*B7)`, `SUM(1, A1, A2*2)`), not just
  plain ranges. This guards a bug where aggregates previously accepted only refs/ranges.
- `IF` (incl. text results), comparisons, nested functions.
- Override handling: stale values are ignored unless a cell is flagged as an override.

### `LoginPage.test.tsx` (3)
Renders the real `LoginPage` with the auth context and router hooks mocked (no network).
Covers: form rendering, a successful login calling the auth layer + navigating, and error
display on failed login.

### `StudentSimulationView.test.tsx` (5)
Renders the real `StudentSimulationView` with router/auth/`AppShell` mocked and the backend
`fetch` calls stubbed. Covers per-page input isolation and that overrides auto-revert as
designed.

**Frontend testing notes**
- `react-router-dom` v7 ships ESM that CRA's Jest resolver can't follow. Each component
  test mocks the specific router hooks it uses; `src/test-utils/react-router-dom-stub.js`
  (wired via `jest.moduleNameMapper` in `frontend/package.json`) covers the general case.

---

## Backend — unit / route (mocked, no DB)

These run with `npm test` in `backend/`. Route tests use `supertest` against the Express
app exported from `src/app.ts`, with the **service layer mocked** — so they verify HTTP
routing, status codes, validation, authorization guards, and request→service wiring, *not*
real database behaviour.

### `excelDataBuilder.test.ts` (12)
Unit tests for `buildExcelData` — parsing an uploaded `.xlsx` into the app's `ExcelData`
shape (cells, sheets, input/output cell classification). Runs against real sample workbooks
in `sample-excel-sheets/`.

### `crossCheck.test.ts` (21)
Correctness cross-check: for every sample workbook, our `FormulaEngine.recomputeAll` is
compared against an **independent oracle** (`src/excel/formulaOracle.ts`, built on the MIT
`fast-formula-parser`). Tests are generated dynamically — one per workbook (~20) plus a
guard that sample workbooks were found. Only cells where both engines produce finite numbers
are compared. This is what surfaced the aggregate-argument bug noted above.

> Oracle caveat: `fast-formula-parser` lacks `MIN`/`MAX`, so those two are supplied by hand
> in the oracle; every other operator/function comes from the third-party parser.

### `authRoutes.test.ts` (12)
Route tests for `POST /auth/login`, `POST /auth/signup`, `GET /auth/organisations`
(auth-protected), and the health check. Auth uses **real** JWT generate/verify
(`jest.requireActual`) while the DB-touching auth service functions are mocked.

### `projectRoutes.test.ts` (23)
Route tests for projects, pages, and student-state endpoints. Includes the Excel-upload
path (asserts the uploaded buffer is parsed and passed through), the "name required" and
"user must belong to an organisation" validations, and ownership/authorization guards
(`created_by !== userId → 403`).

### `simulationRoutes.test.ts` (9)
Route tests for `/simulations/*`: `401` without a token; `400` when `state`/`finalState`
is missing; `200`/`201` happy paths forwarding the caller as `user_id`; and the
**teacher-only `403` guard** on `GET /:projectId/results` (verifies `project.created_by`),
plus the authorized path.

---

## Backend — DB integration (opt-in, real database)

### `projectService.integration.test.ts` (15)
Exercises the **real** service functions against a **real local Supabase/Postgres**, using
the actual `@supabase/supabase-js` client (no mocks). Verifies that the service-layer SQL
matches the committed schema (`backend/migrations/001-003`): foreign keys, column defaults,
`UNIQUE`/`CHECK` constraints, JSONB round-trips, upserts, and ordering.

This validates **SQL/schema correctness**, not RLS — the backend uses the service-role key,
which bypasses RLS. Authorization is covered separately at the route layer.

Covers:
- **Organisations & users**: create/list org; `registerUser` persists, hides `password_hash`,
  and the DB enforces the `UNIQUE` username and `role` `CHECK` constraints.
- **Projects**: `createProject` (FKs, `visibility` default, JSONB `excel_data`),
  `updateProject`, `deleteProject`, `getProjectsByTeacher`.
- **Pages**: `createPage` + `getPagesByProject` (ordered by `sort_order`), `updatePage`,
  `deletePage`.
- **Simulation service**: `getSimulationProgress` "not found" → `null` (PGRST116),
  `saveSimulationProgress` upsert on `(project_id, user_id)` (second save updates the same
  row), `completeSimulation` insert + `getProjectResults` newest-first ordering,
  `getUserProjectResults` user filtering.

Scope notes:
- Student-related paths (student projects/results/state and the attempts RPC) are
  intentionally **excluded** for now.
- `user_id` on `simulation_progress`/`project_results` is a role-agnostic FK to `users(id)`;
  the tests seed a **teacher-role** user as the simulation runner (no student rows created).

**Opt-in gating**: the suite runs only when `RUN_DB_IT=1` **and** `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` are set. Otherwise the whole suite is `describe.skip`, so the
default `npm test` and any environment without a database are unaffected.

#### Running it locally (requires Docker)

```bash
# 1. Start the local Supabase stack (first run pulls images, ~3 min; then ~35s)
npx supabase start

# 2. Apply the migrations to the local DB
cd backend && npm run db:migrate:local

# 3. Run the integration tests. Get the key from `npx supabase status`.
RUN_DB_IT=1 \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `npx supabase status -o env`> \
npm run test:integration

# 4. Tear down when done
npx supabase stop
```

`backend/package.json` provides helper scripts:
- `db:migrate:local` — applies `migrations/001-003` to the local stack via a `postgres:16`
  container.
- `test:integration` — sets `RUN_DB_IT=1` and runs Jest on the `integration` pattern (you
  still supply `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).

See [CI.md](./CI.md) for how this same flow runs automatically in GitHub Actions.
