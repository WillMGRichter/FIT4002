# Documentation

Reference docs for the SmartSim test suite and CI.

- [TESTS.md](./TESTS.md) — every test file, what it covers, and how to run each suite.
- [CI.md](./CI.md) — GitHub Actions setup, with a focus on how the database integration job is wired.

## Quick reference

| Suite | Location | Count | DB needed? |
|-------|----------|-------|------------|
| Frontend unit/component | `frontend/src/**/*.test.{ts,tsx}` | 56 | No |
| Backend unit/route (mocked) | `backend/src/**/*.test.ts` (excl. integration) | 77 | No |
| Backend DB integration (opt-in) | `backend/src/services/*.integration.test.ts` | 15 | Yes (local Supabase) |

Default local commands:

```bash
# frontend
cd frontend && npm test           # watch mode; CI=true for one-shot

# backend (mocked only — integration auto-skips without env)
cd backend && npm test
```

See [TESTS.md](./TESTS.md) for the integration-test run steps.
