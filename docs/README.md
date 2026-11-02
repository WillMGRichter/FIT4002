# Documentation

Reference docs for the SmartSim test suite and CI.

- [TESTS.md](./TESTS.md) — every test file, what it covers, and how to run each suite.
- [CI.md](./CI.md) — GitHub Actions setup, with a focus on how the database integration job is wired.
- [STUDENT_JOIN.md](./STUDENT_JOIN.md) — anonymous student join links and LAN access setup/troubleshooting.
- [submission/](./submission/) — the FIT4002 submission documents (design, guides, project management). Linked from the [root README](../README.md).

## Quick reference

| Suite | Location | Count | DB needed? |
|-------|----------|-------|------------|
| Frontend unit/component | `frontend/src/**/__tests__/*.test.{ts,tsx}` | 199 | No |
| Backend unit/route (mocked) | `backend/src/**/__tests__/*.test.ts` (excl. integration) | 181 | No |
| Backend DB integration (opt-in) | `backend/src/services/__tests__/*.integration.test.ts` | 15 | Yes (local Supabase) |

Test files live in `__tests__/` folders next to the code they cover (e.g.
`src/utils/__tests__/FormulaEngine.test.ts`), the standard layout for both the CRA/Jest
frontend and the ts-jest backend.

Default local commands:

```bash
# frontend
cd frontend && npm test           # watch mode; CI=true for one-shot

# backend (mocked only — integration auto-skips without env)
cd backend && npm test
```

See [TESTS.md](./TESTS.md) for the integration-test run steps.
