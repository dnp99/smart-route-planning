# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/change-log.md` - implementation history and completed change log
- `plans/nurse-patient-management-execution-plan.md` - patient management feature execution plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Completed backend-first nurse/patient work by fixing patient update semantics and extending optimize-route backend support to accept patient-linked `destinations[]` payloads (while preserving legacy `addresses[]` compatibility).

### Files added/updated/deleted
- Updated:
  - `shared/contracts/optimizeRoute.ts`
  - `backend/src/app/api/optimize-route/types.ts`
  - `backend/src/app/api/optimize-route/validation.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.ts`
  - `backend/src/app/api/optimize-route/validation.test.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.test.ts`
  - `backend/src/app/api/optimize-route/route.test.ts`
  - `backend/src/lib/patients/patientRepository.ts`
  - `backend/src/lib/patients/patientRepository.test.ts`
  - `backend/src/db/migrations/0000_create_nurses_and_patients.sql`
  - `backend/package.json`
  - `backend/README.md`
  - `plan.md`

### Why
- `googlePlaceId` could not be explicitly cleared to `null` during patient updates due to nullish-coalescing fallback behavior.
- Backend optimize-route needed to support patient-linked destination objects for the nurse/patient execution plan while keeping existing frontend calls functional during phased rollout.
- Backend startup/setup needed a deterministic default-nurse seed path; migration now seeds `default-nurse` idempotently and docs/scripts now include migration execution.
- Address updates now clear stale `googlePlaceId` when place metadata is omitted, preventing mismatched address/place-id persistence.

### Verification
- LSP diagnostics on all modified TypeScript files: ✅ no diagnostics
- Backend:
  - `npm test` ✅ (14 files, 142 tests)
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend regression (shared contract change safety):
  - `npm test` ✅ (6 files, 20 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

For full implementation history, see `plans/change-log.md`.

## Latest change addendum

### Change
Reduced backend test coverage thresholds from 100% to 90%.

### Files added/updated/deleted
- Updated:
  - `backend/vitest.config.ts`
  - `plan.md`

### Why
- The requested backend quality gate is 90% minimum coverage instead of 100%.

### Verification
- LSP diagnostics:
  - `backend/vitest.config.ts` ✅ no diagnostics
- Backend coverage run:
  - `npm run test:coverage` ✅ passes with thresholds at 90%
