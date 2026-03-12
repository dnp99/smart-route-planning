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

## Latest change addendum

### Change
Implemented phase-1 frontend routing and Patients UI surface (`/patients` and `/route-planner`) with patient search/list/create/edit/delete flows backed by the new patient APIs.

### Files added/updated/deleted
- Added:
  - `frontend/src/components/patients/PatientsPage.tsx`
  - `frontend/src/components/patients/patientService.ts`
  - `frontend/src/tests/patients/PatientsPage.test.tsx`
  - `frontend/src/tests/patients/patientService.test.ts`
  - `frontend/src/tests/appRoutes.test.tsx`
- Updated:
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
  - `frontend/src/components/AddressAutocompleteInput.tsx`
  - `frontend/vitest.config.ts`
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `plan.md`

### Why
- Add locked client-side navigation and dedicated patient-management page before route-planner patient-selection integration.
- Provide typed frontend API access for patient CRUD/search and keep behavior consistent with backend phase-1 contract.
- Extend autocomplete component with suggestion metadata callbacks so patient forms can capture `googlePlaceId` when available.

### Verification
- Frontend:
  - `npm test` ✅ (9 files, 29 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Completed route-planner phase-1 patient integration by replacing free-text destination workflow with saved-patient selection, adding manual-vs-patient end mode, and submitting patient-linked `destinations[]` to optimize-route.

### Files added/updated/deleted
- Added:
  - `frontend/src/components/routePlanner/usePatientSearch.ts`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/components/routePlanner/useRouteOptimization.ts`
  - `frontend/src/components/routePlanner/routePlannerService.ts`
  - `frontend/src/components/AddressAutocompleteInput.tsx`
  - `frontend/src/tests/routePlanner/useRouteOptimization.test.ts`
  - `frontend/src/tests/routePlanner/routePlannerService.test.ts`
  - `frontend/vitest.config.ts`
  - `plan.md`

### Why
- Route-planner destinations now need patient identity preservation (`patientId`, `patientName`, `googlePlaceId`) for deterministic UI mapping and backend parity with the nurse/patient execution plan.
- End-point selection now supports explicit mode switching so nurses can choose either manual end address input or a saved patient end address before optimizing.

### Verification
- Frontend:
  - `npm test` ✅ (10 files, 32 tests)
  - `npm run lint` ✅
  - `npm run build` ✅
- Backend regression:
  - `npm test` ✅ (14 files, 142 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Filled remaining phase-1 frontend automated test gaps from the nurse/patient execution plan, including patients-page validation/search/duplicate coverage, route-planner destination-removal coverage, and integration-style cross-page lifecycle coverage.

### Files added/updated/deleted
- Added:
  - `frontend/src/tests/patients/PatientsPage.addressAutocomplete.test.tsx`
  - `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
- Updated:
  - `frontend/src/tests/patients/PatientsPage.test.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### Why
- Close plan-specified automated coverage for:
  - patients-page search and validation behaviors,
  - duplicate-name disambiguation behavior,
  - route-planner destination removal behavior,
  - integration lifecycle and `/patients` → `/route-planner` handoff behavior.

### Verification
- Frontend:
  - `npm test` ✅ (12 files, 39 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Aligned the CareFlow branding update with a responsive patients-page refactor and finalized the breaking optimize-route contract update so patient-linked destinations are required end to end.

### Files added/updated/deleted
- Added:
  - `frontend/src/components/patients/PatientFormModal.tsx`
  - `frontend/src/components/patients/PatientsTable.tsx`
  - `frontend/src/components/patients/patientForm.ts`
- Updated:
  - `shared/contracts/optimizeRoute.ts`
  - `backend/src/app/api/optimize-route/validation.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.ts`
  - `backend/src/app/api/optimize-route/validation.test.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.test.ts`
  - `backend/src/app/api/optimize-route/route.test.ts`
  - `backend/README.md`
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/components/routePlanner/routePlannerService.ts`
  - `frontend/src/components/patients/PatientsPage.tsx`
  - `frontend/src/components/responsiveStyles.ts`
  - `frontend/src/App.jsx`
  - `frontend/index.html`
  - `frontend/public/car.svg`
  - `frontend/README.md`
  - `frontend/src/tests/patients/PatientsPage.test.tsx`
  - `frontend/src/tests/patients/PatientsPage.addressAutocomplete.test.tsx`
  - `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `frontend/src/tests/routePlanner/routePlannerService.test.ts`
  - `plan.md`

### Why
- The optimize-route contract needed to match the locked execution plan by removing legacy `addresses[]` support and preserving patient identity for end-point routing.
- The patients page had grown too large and was not responsive enough; splitting it into modal/table/form helper modules makes the UI easier to maintain and better on mobile.
- The product name and browser/title branding were updated from `Navigate Easy` to `CareFlow` to fit the wider nurse-operations scope.
- Shared shell spacing was normalized so the app header and page content align consistently.

### Verification
- Frontend:
  - `npm test` ✅ (12 files, 40 tests)
- Backend:
  - `npm test` ✅ (14 files, 141 tests)

## Latest change addendum

### Change
Added a future-work note for the remaining nurse/patient execution-plan gaps and the intentional Patients-page UX deviation.

### Files added/updated/deleted
- Added:
  - `plans/nurse-patient-management-follow-ups.md`
- Updated:
  - `plan.md`

### Why
- Preserve a concrete record of what is still not fully aligned with `plans/nurse-patient-management-execution-plan.md`.
- Make the remaining route-contract and request-behavior gaps explicit for a future pass.
- Record that the current patients-page modal/table UX is an intentional divergence from the original split-panel page plan.

### Verification
- Documentation-only change
- No code paths changed
