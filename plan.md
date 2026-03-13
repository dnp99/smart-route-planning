# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/change-log.md` - implementation history and completed change log
- `plans/nurse-patient-management-execution-plan.md` - patient management feature execution plan
- `plans/jwt-authentication-execution-plan.md` - JWT authentication rollout execution plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Implemented end-to-end JWT authentication with login-gated frontend access and backend route protection across all business endpoints.

### Files added/updated/deleted
- Added:
  - `plans/jwt-authentication-execution-plan.md`
  - `shared/contracts/auth.ts`
  - `backend/src/lib/auth/password.ts`
  - `backend/src/lib/auth/jwt.ts`
  - `backend/src/lib/auth/requireAuth.ts`
  - `backend/src/app/api/auth/login/route.ts`
  - `backend/src/app/api/auth/me/route.ts`
  - `backend/src/lib/auth/password.test.ts`
  - `backend/src/lib/auth/jwt.test.ts`
  - `backend/src/lib/auth/requireAuth.test.ts`
  - `backend/src/app/api/auth/login/route.test.ts`
  - `backend/src/app/api/auth/me/route.test.ts`
  - `frontend/src/components/auth/authSession.ts`
  - `frontend/src/components/auth/authFetch.ts`
  - `frontend/src/components/auth/authService.ts`
  - `frontend/src/components/auth/LoginPage.tsx`
  - `backend/drizzle/0001_useful_skaar.sql`
  - `backend/drizzle/meta/0001_snapshot.json`
- Updated:
  - `shared/contracts/index.ts`
  - `backend/src/db/schema.ts`
  - `backend/src/db/seed-default-nurse.ts`
  - `backend/src/lib/http.ts`
  - `backend/src/lib/patients/patientRepository.ts`
  - `backend/src/app/api/optimize-route/route.ts`
  - `backend/src/app/api/address-autocomplete/route.ts`
  - `backend/src/app/api/patients/route.ts`
  - `backend/src/app/api/patients/[id]/route.ts`
  - backend test files for optimize-route/address-autocomplete/patients/http/repository coverage
  - `frontend/src/App.jsx`
  - `frontend/src/components/AddressAutocompleteInput.tsx`
  - `frontend/src/components/patients/patientService.ts`
  - `frontend/src/components/routePlanner/routePlannerService.ts`
  - frontend route/service/integration test files to account for auth-gated navigation and bearer headers
  - `README.md`
  - `backend/README.md`
  - `frontend/README.md`
  - `backend/.env.local.example`
  - `DEPLOYMENT.md`
  - `plan.md`

### Why
- Users now must authenticate before seeing patient or route-planner data.
- Backend business endpoints now enforce JWT bearer authentication uniformly.
- Authenticated nurse identity now scopes patient operations instead of env-based default-nurse request context.
- Added auth contracts and tests to keep frontend/backend behavior aligned and verifiable.

### Verification
- LSP diagnostics on modified implementation files: ✅ no errors.
- Backend:
  - `npm test` ✅ (19 files, 168 tests)
  - `npm run test:coverage` ✅ (98%+ overall, thresholds pass)
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm test` ✅ (12 files, 41 tests)
  - `npm run test:coverage` ✅ (thresholds pass)
  - `npm run lint` ✅
  - `npm run build` ✅

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

## Latest change addendum

### Change
Added a deferred Vercel database setup checklist for enabling deployed patient-management functionality later.

### Files added/updated/deleted
- Added:
  - `plans/vercel-database-setup-checklist.md`
- Updated:
  - `plan.md`

### Why
- The deployed patient feature cannot work until a Postgres database and required Vercel environment variables exist.
- A simple checklist reduces the chance of missing schema, seed, or env configuration steps when this is picked up later.

### Verification
- Documentation-only change
- No code paths changed

## Latest change addendum

### Change
Polished Patients-page and Route Planner UI consistency with shared card, search, and panel treatments for a cleaner local demo experience.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/components/patients/PatientsPage.tsx`
  - `frontend/src/components/responsiveStyles.ts`
  - `plan.md`

### Why
- The Patients page and Route Planner had started to diverge in spacing, panel treatment, and search/list styling, which made the demo feel inconsistent even though the workflows were related.
- Consolidating shared surface, panel, and input styles improves mobile and desktop presentation without depending on backend or database setup.

### Verification
- Frontend:
  - `npm test` ✅

## Latest change addendum

### Change
Removed the extra wrapper and inner card styling around the Patients search-and-list surface to reduce unnecessary mobile padding.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/patients/PatientsPage.tsx`
  - `plan.md`

### Why
- The additional wrapper around the patient search bar and list was unnecessary and added extra padding in mobile layouts.

### Verification
- UI-only structural change
- Tests not rerun

## Latest change addendum

### Change
Repaired the backend migration pipeline by switching to Drizzle-managed migration output, generating baseline metadata, and replacing the hand-written initial SQL migration with a committed Drizzle baseline.

### Files added/updated/deleted
- Added:
  - `backend/drizzle/0000_swift_shiver_man.sql`
  - `backend/drizzle/meta/0000_snapshot.json`
  - `backend/drizzle/meta/_journal.json`
- Updated:
  - `backend/drizzle.config.ts`
  - `backend/package.json`
  - `backend/README.md`
  - `plans/vercel-database-setup-checklist.md`
  - `plan.md`
- Deleted:
  - `backend/src/db/migrations/0000_create_nurses_and_patients.sql`

### Why
- `drizzle-kit migrate` could not run because the repository was missing Drizzle migration metadata such as `meta/_journal.json`.
- Moving to a Drizzle-managed migration folder makes future schema changes generate and apply consistently.
- The baseline migration now includes the `pgcrypto` extension and default nurse seed so first-time database setup works through `db:migrate`.

### Verification
- Backend:
  - `npm run db:generate` ✅

## Latest change addendum

### Change
Recorded the completed CareFlow UI polish and Drizzle migration-pipeline repair in `plans/change-log.md`.

### Files added/updated/deleted
- Updated:
  - `plans/change-log.md`
  - `plan.md`

### Why
- The repository keeps `plans/change-log.md` as the implementation history for completed work, so the recent UI and migration changes needed to be added there explicitly.

### Verification
- Documentation-only change

## Latest change addendum

### Change
Removed the completed Vercel database setup checklist planning document now that the Neon/Vercel setup and migration flow are implemented.

### Files added/updated/deleted
- Updated:
  - `plan.md`
- Deleted:
  - `plans/vercel-database-setup-checklist.md`

### Why
- The checklist had served its purpose and no longer represents pending work.

### Verification
- Documentation-only change

## Latest change addendum

### Change
Updated the default seeded nurse display name from `Default Nurse` to `Nicole Su` and made the seed path update existing rows idempotently.

### Files added/updated/deleted
- Updated:
  - `backend/src/db/seed-default-nurse.ts`
  - `backend/drizzle/0000_swift_shiver_man.sql`
  - `plan.md`

### Why
- New and existing environments should use the real default nurse display name instead of the placeholder seed value.

### Verification
- Code change only
- Tests not rerun

## Latest change addendum

### Change
Restricted the auth bootstrap migration so only `default-nurse` receives the seeded development password instead of backfilling passwords for every existing nurse.

### Files added/updated/deleted
- Updated:
  - `backend/drizzle/0001_useful_skaar.sql`
  - `plan.md`

### Why
- The previous migration assigned the same known password to any nurse missing credentials, which is too broad even for bootstrap behavior.
- The branch now limits credential seeding to the intended default nurse account.

### Verification
- Migration SQL only
- Tests not rerun

## Latest change addendum

### Change
Implemented frontend startup session validation and backend login rate limiting for the JWT authentication flow.

### Files added/updated/deleted
- Added:
  - `backend/src/app/api/auth/requestGuards.ts`
  - `backend/src/app/api/auth/requestGuards.test.ts`
- Updated:
  - `backend/src/app/api/auth/login/route.ts`
  - `backend/src/app/api/auth/login/route.test.ts`
  - `backend/README.md`
  - `backend/.env.local.example`
  - `frontend/src/App.jsx`
  - `frontend/src/tests/appRoutes.test.tsx`
  - `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
  - `plan.md`

### Why
- The app previously trusted any locally stored token on startup without confirming that it still mapped to a valid authenticated nurse session.
- The login endpoint needed basic brute-force protection to match the rate-limit posture already used on the other public-facing backend endpoints.

### Verification
- Backend:
  - `npm test` ✅ (20 files, 171 tests)
- Frontend:
  - `npm test` ✅ (12 files, 42 tests)

## Latest change addendum

### Change
Removed the remaining default-nurse bootstrap path so auth and patient access now assume real nurse accounts already exist in the database.

### Files added/updated/deleted
- Updated:
  - `backend/drizzle/0000_swift_shiver_man.sql`
  - `backend/drizzle/0001_useful_skaar.sql`
  - `backend/src/lib/patients/patientRepository.ts`
  - `backend/src/lib/patients/patientRepository.test.ts`
  - `backend/.env.local.example`
  - `backend/README.md`
  - `README.md`
  - `plan.md`
- Deleted:
  - `backend/src/db/seed-default-nurse.ts`
  - `backend/src/lib/patients/nurseContext.ts`
  - `backend/src/lib/patients/nurseContext.test.ts`

### Why
- Production should not depend on or create a special fallback nurse account.
- JWT-authenticated nurse identity is now the only supported path for patient access, and nurse records are expected to be provisioned explicitly.

### Verification
- Backend:
  - `npm test` ✅ (19 files, 164 tests)
- Frontend:
  - `npm test` ✅ (12 files, 42 tests)

## Latest change addendum

### Change
Added end-to-end nurse sign-up functionality so users can create an account and immediately enter the authenticated app flow.

### Files added/updated/deleted
- Added:
  - `backend/src/app/api/auth/signup/route.ts`
  - `backend/src/app/api/auth/signup/route.test.ts`
  - `frontend/src/tests/auth/authService.test.ts`
  - `frontend/src/tests/auth/LoginPage.test.tsx`
- Updated:
  - `shared/contracts/auth.ts`
  - `backend/src/lib/patients/patientRepository.ts`
  - `backend/src/lib/patients/patientRepository.test.ts`
  - `frontend/src/components/auth/authService.ts`
  - `frontend/src/components/auth/LoginPage.tsx`
  - `frontend/src/tests/appRoutes.test.tsx`
  - `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
  - `README.md`
  - `backend/README.md`
  - `plan.md`

### Why
- Authentication now needs an explicit account-creation flow because the application no longer bootstraps a default nurse account automatically.
- New signups should be able to receive a JWT immediately and continue into the protected patient and route-planner experience without a separate admin step.

### Verification
- Backend:
  - `npm test` ✅ (20 files, 170 tests)
- Frontend:
  - `npm test` ✅ (14 files, 45 tests)

## Latest change addendum

### Change
Polished the frontend auth experience by adding sign-up password confirmation and clearer login/sign-up helper copy.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/auth/LoginPage.tsx`
  - `frontend/src/tests/auth/LoginPage.test.tsx`
  - `plan.md`

### Why
- New signups should get immediate feedback before submitting mismatched credentials.
- The auth form copy should better distinguish between signing in and creating a new CareFlow account.

### Verification
- Frontend:
  - `npm test` ✅ (14 files, 46 tests)

## Latest change addendum

### Change
Removed the synchronous auth-resolution state update from the app startup effect so the frontend lint rule for `set-state-in-effect` passes cleanly.

### Files added/updated/deleted
- Updated:
  - `frontend/src/App.jsx`
  - `plan.md`

### Why
- The session bootstrap effect should not call `setState` synchronously when no token is present.
- The auth-change listener and async `/api/auth/me` validation already cover the necessary resolution paths.

### Verification
- Frontend:
  - `npm run lint` ✅
