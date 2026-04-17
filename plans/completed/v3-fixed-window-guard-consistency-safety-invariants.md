# V3 Fixed-Window Guard Consistency + Safety Invariants Completion Note

- Completed: 2026-03-27
- Scope: `backend/src/app/api/optimize-route/v3` only

## Implemented

1. Added a shared acceptance helper:
   - `isAcceptedImprovement(candidate, reference, objective)`
   - Enforces uniform fixed-window safety contract before objective ranking.
2. Kept authoritative safety guard semantics via `worsensFixedLateness(...)`:
   - Reject when `fixedLateCount` increases
   - Reject when `fixedLateSeconds` increases at equal count
   - Reject when `fixedSlackConsumedSeconds` increases at equal fixed-lateness tuple
3. Replaced ad-hoc acceptance logic with shared helper in all acceptance/update paths:
   - `localSearchSweep(...)`
   - `refineTrailingFlexibleBlocksAheadOfFixed(...)`
   - `promoteNoWindowBeforeLateFixedAnchors(...)`
   - global best update in `solveRouteWithIls(...)`
   - post-refinement best update
   - post-promotion best update
4. Tightened promotion pass behavior:
   - Removed fixed-lateness-only acceptance bypass
   - Promotion candidates now require full safety contract + strict comparator improvement

## Test Coverage

1. Added/updated safety-focused tests in `optimizeRouteService.test.ts`:
   - Fixed-slack protection under seeded perturbations
   - Preferred-window flexible is not moved before near-due fixed when that only burns fixed slack
   - Existing late-fixed recovery scenario retained to verify valid fixed-lateness improvements still apply
2. Existing fixed-safety regression tests remain green.

## Verification

- Targeted v3 suite:
  - `cd backend && npm run test -- src/app/api/optimize-route/v3/optimizeRouteService.test.ts`
  - `54 passed`
- Full backend tests:
  - `cd backend && npm run test`
  - `30 files, 413 tests passed`
- Lint + ES compatibility:
  - `cd backend && npm run lint`
  - passed

## Contracts

- No API/request/response schema changes.
- No warning contract/message changes.
- No `algorithmVersion` contract changes.
