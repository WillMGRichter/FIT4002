# Backend tests

## Unit / route tests (default)

Mocked, no external services. Run everything:

```bash
npm test
```

These cover the Excel builder, the FormulaEngine cross-check (against an independent
oracle), and the auth/project/page/student-state routes (with Supabase mocked).

## Database integration tests (opt-in)

`src/services/*.integration.test.ts` exercise the real service functions against a
**local Supabase/Postgres**, verifying the service SQL matches the committed schema
(`migrations/001-003`): FKs, defaults, CHECK/UNIQUE constraints, JSONB round-trips,
and ordering. They validate SQL/schema correctness — not RLS, which the service-role
key bypasses.

These are **skipped by default**. They only run when `RUN_DB_IT=1` and the Supabase
env vars are set, so `npm test` and CI-without-a-DB are unaffected.

Scope note: student-related paths (student projects/results/state and the attempts
RPC) are intentionally excluded for now.

### Running locally

Requires Docker.

```bash
# 1. Start the local Supabase stack (first run pulls images, ~3 min; then ~35s)
npx supabase start

# 2. Apply the migrations to the local DB
npm run db:migrate:local

# 3. Run the integration tests. Get the secret key from `npx supabase status`.
RUN_DB_IT=1 \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<secret key from `npx supabase status`> \
npm run test:integration

# 4. Tear down when done
npx supabase stop
```
