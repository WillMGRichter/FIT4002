# Continuous Integration

CI runs on GitHub Actions. The workflow lives at
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Triggers

```yaml
on:
  pull_request:
    branches: [dev]
  push:
    branches: [dev]
```

- **Pull requests targeting `dev`** — runs when a PR into `dev` is opened and on every push
  to that PR's branch (the `synchronize` event). This is how feature branches get CI. The
  trigger is author-agnostic: it runs for a PR from *any* collaborator. This repo is private
  and contributors are direct collaborators, so PRs come from in-repo branches (not forks);
  no fork-approval gate applies.
- **Pushes to `dev`** — runs on direct pushes to `dev` (e.g. after a merge).

> Feature branches (e.g. `test/test-suite`) are intentionally **not** listed under `push`.
> They already get CI via their PR into `dev`, so listing them under `push` too would run
> every job twice (one `push` run + one `pull_request` run). The tradeoff: a branch with no
> open PR gets no CI until the PR is opened.

A `concurrency` group (`ci-<ref>`, `cancel-in-progress: true`) cancels superseded runs on
the same ref to save minutes.

## Jobs

All three jobs run in parallel on `ubuntu-latest` with Node 22 and per-workspace npm
caching.

| Job | Purpose | DB |
|-----|---------|:--:|
| `Backend (unit + routes)` | `npm ci` → `tsc --noEmit` → `npm test` (77 mocked tests) | — |
| `Frontend (unit + type-check)` | `npm ci` → `tsc --noEmit` → `react-scripts test` (56 tests) | — |
| `Backend (DB integration)` | boots Supabase, migrates, runs the 15 opt-in integration tests | ✔ |

### Backend (mocked) — dummy Supabase env

`backend/src/config/supabase.ts` validates `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
**at import time** and throws if they are missing. On a clean runner these are absent, which
would crash any suite that imports the Supabase client. Because the mocked suite never makes
real Supabase calls, the job supplies harmless dummy values so the module can load:

```yaml
env:
  SUPABASE_URL: http://localhost:54321
  SUPABASE_SERVICE_ROLE_KEY: dummy-key-for-mocked-tests
```

The production fail-fast check is intentionally left intact.

### Frontend

Runs `react-scripts test` with `CI: true` and `--watchAll=false` so it executes once and
exits (no watch mode).

## Database integration job (detailed)

This is the job that gives the integration tests real value in CI. It reproduces the same
local flow — start stack → migrate → test → stop — on the runner.

```yaml
backend-integration:
  name: Backend (DB integration)
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
        cache-dependency-path: backend/package-lock.json
    - run: npm ci

    - name: Start Supabase stack
      working-directory: .
      run: npx --yes supabase start

    - name: Apply migrations
      run: npm run db:migrate:local

    - name: Run integration tests
      working-directory: .
      run: |
        eval "$(npx --yes supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
        echo "Using API_URL=$API_URL"
        cd backend
        RUN_DB_IT=1 \
        SUPABASE_URL="$API_URL" \
        SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
        npx jest integration

    - name: Stop Supabase stack
      if: always()
      working-directory: .
      run: npx --yes supabase stop || true
```

Step-by-step:

1. **Checkout + Node 22 + `npm ci`** — standard setup with npm cache keyed on
   `backend/package-lock.json`.
2. **Start Supabase stack** — `npx supabase start` from the repo root, where
   `supabase/config.toml` lives (committed via `supabase init`). Docker is available on
   `ubuntu-latest`, and the stack config uses fixed local dev defaults.
3. **Apply migrations** — `npm run db:migrate:local` runs from `backend/` and applies
   `migrations/001-003` by piping each `.sql` into a `postgres:16` container connected to
   the stack's Postgres (`127.0.0.1:54322`) using Docker `--network host` (a Linux feature,
   so it works on the Linux runner).
4. **Run integration tests** — instead of hardcoding a key, it reads the running stack's
   values from `supabase status -o env` and exports:
   - `SUPABASE_URL` = `API_URL` (`http://127.0.0.1:54321`)
   - `SUPABASE_SERVICE_ROLE_KEY` = `SERVICE_ROLE_KEY` — the fixed local dev **service-role
     JWT** (bypasses RLS) that `@supabase/supabase-js` expects.

   With `RUN_DB_IT=1` set, the otherwise-skipped integration suite runs.
5. **Stop Supabase stack** — `if: always()` guarantees teardown even if the tests fail.

### Why read the key at runtime?

The Supabase CLI generates the local keys when the stack starts. Reading them from
`supabase status -o env` avoids baking in a machine- or version-specific value, so the job
keeps working across CLI versions and runners. These are well-known local **dev** defaults —
not real secrets — so no GitHub repository secret is required.

### Timing

- First `supabase start` (cold, pulls images): ~3 min.
- Warm start: ~35s.
- The 15 integration tests themselves: ~2.6s.

For strict correctness the start → migrate → test → stop steps run sequentially so a run
never overlaps a teardown.

## Notes / possible follow-ups

- GitHub currently emits informational annotations (Node-20 action deprecation; the future
  `ubuntu-latest` → Ubuntu 26 migration). Neither affects runs; action versions can be
  bumped later to silence them.
- CI is currently **reporting** only. To make checks *required* before merging into `dev`,
  add branch protection on `dev` requiring the three status checks — this is a repo setting,
  not part of the workflow file.
