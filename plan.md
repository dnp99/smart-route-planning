# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/plan.md` - implementation history and completed change log
- `plans/google-routes-phase-1-plan.md` - upcoming Phase 1 Google Routes migration plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Increased frontend test coverage above 80% and added enforced frontend coverage thresholds.

### Files added/updated/deleted
- Added:
  - `frontend/vitest.config.ts`
  - `frontend/src/components/apiBaseUrl.test.ts`
  - `frontend/src/components/routePlanner/useTheme.test.ts`
  - `frontend/src/components/routePlanner/useDestinationAddresses.test.ts`
  - `frontend/src/components/routePlanner/useRouteOptimization.test.ts`
- Updated:
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `plan.md`
  - `plans/plan.md`

### Why
You requested higher frontend coverage. Enforcing coverage thresholds and adding focused unit tests for route-planner modules ensures frontend behavior is protected before further UI refactors.

### Verification
- `frontend`: `npm run test:coverage` ✅
  - Coverage: **97.61% statements, 93.22% branches, 100% functions, 97.60% lines**
  - Threshold target (>=80%) passed
- `frontend`: `npm run lint`, `npm run build` ✅

For full implementation details, see `plans/plan.md` section **38) Frontend Coverage Increased to >=80%**.

For full implementation details, see `plans/plan.md` section **33) Shared Backend HTTP/CORS/Error Helpers**.
