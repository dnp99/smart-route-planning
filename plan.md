# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/change-log.md` - implementation history and completed change log

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

## Latest change addendum

### Change
Changed Route Planner destination cards to default to collapsed window details (`Edit window`) when a patient is added.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### Why
- Nurses requested newly added destinations to open in compact mode first, matching the `Edit window` card state instead of expanded details.
- This reduces visual noise when adding multiple patients and keeps window editing opt-in.

### Verification
- Frontend:
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx src/tests/integration/patientsRoutePlanner.integration.test.tsx` ✅ (2 files, 19 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Updated optimize-route result rendering in Route Planner to a patient-first layout with clickable patient names that reveal details inline.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
  - `plan.md`

### Why
- The existing result rows were address-first and dense; nurses requested a clearer patient-centric summary.
- Patient names are now interactive so details are available on demand while keeping the default list compact.
- Expected start time is now visually emphasized on its own line to improve scanability.

### Verification
- Frontend:
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx src/tests/integration/patientsRoutePlanner.integration.test.tsx` ✅ (2 files, 19 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Deleted `plans/optimize-route-v2-time-first-execution-plan.md` from the plans folder.

### Files added/updated/deleted
- Deleted:
  - `plans/optimize-route-v2-time-first-execution-plan.md`
- Updated:
  - `plan.md`

### Why
- The v2 time-first execution plan is no longer needed in the active planning folder.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Deleted `plans/nurse-patient-management-execution-plan.md` from the plans folder.

### Files added/updated/deleted
- Deleted:
  - `plans/nurse-patient-management-execution-plan.md`
- Updated:
  - `plan.md`

### Why
- The nurse patient-management execution plan is no longer needed in the active planning folder.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Deleted `plans/jwt-authentication-remediation-release-note.md` from the plans folder.

### Files added/updated/deleted
- Deleted:
  - `plans/jwt-authentication-remediation-release-note.md`
- Updated:
  - `plan.md`

### Why
- The release note file is no longer needed in the active planning folder.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Deleted completed execution-plan records from `plans/` to keep the active planning folder focused on remaining/open planning artifacts.

### Files added/updated/deleted
- Deleted:
  - `plans/jwt-authentication-execution-plan.md`
  - `plans/login-flow-hardening-execution-plan.md`
  - `plans/nurse-patient-management-follow-ups.md`
  - `plans/optimize-route-v2-gap-closure-execution-plan.md`
- Updated:
  - `plan.md`

### Why
- These documents were already marked `Completed`/`Implemented` and no longer represent active planning work.
- Keeping completed execution records out of the active plan list reduces noise during planning reviews.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Implemented login flow hardening backend controls across auth endpoints, including secure transport enforcement, security headers, distributed-capable auth rate limiting, and redaction-safe audit logging.

### Files added/updated/deleted
- Added:
  - `backend/src/lib/rateLimit/authLoginRateLimit.ts`
  - `backend/src/lib/rateLimit/authLoginRateLimit.test.ts`
  - `backend/src/lib/auth/auditLogger.ts`
  - `backend/src/lib/auth/auditLogger.test.ts`
- Updated:
  - `backend/src/lib/http.ts`
  - `backend/src/lib/http.test.ts`
  - `backend/src/app/api/auth/requestGuards.ts`
  - `backend/src/app/api/auth/requestGuards.test.ts`
  - `backend/src/app/api/auth/login/route.ts`
  - `backend/src/app/api/auth/login/route.test.ts`
  - `backend/src/app/api/auth/signup/route.ts`
  - `backend/src/app/api/auth/signup/route.test.ts`
  - `backend/src/app/api/auth/me/route.ts`
  - `backend/src/app/api/auth/me/route.test.ts`
  - `backend/README.md`
  - `plans/login-flow-hardening-execution-plan.md`
  - `plan.md`

### Why
- Auth hardening requirements were still marked pending and only partially implemented, leaving transport policy, rate-limit consistency, and audit behavior uneven across auth endpoints.
- This implementation closes the backend scope in the hardening plan and documents the exact controls and environment flags required for production operation.

### Verification
- Backend:
  - `npm test -- --run src/app/api/auth/requestGuards.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/signup/route.test.ts src/app/api/auth/me/route.test.ts src/lib/http.test.ts src/lib/rateLimit/authLoginRateLimit.test.ts src/lib/auth/auditLogger.test.ts` ✅ (7 files, 44 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Closed nurse patient-management follow-up gaps by updating patient-end request behavior in Route Planner and marking the follow-up tracker as completed.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plans/nurse-patient-management-follow-ups.md`
  - `plan.md`

### Why
- In patient-end mode, the selected end patient should define the final endpoint only and should not be auto-added as an intermediate optimize destination.
- The follow-up tracker needed to reflect current behavior and close stale contract-follow-up language now that the planner flow is standardized on v2 contracts.

### Verification
- Frontend:
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅

## Latest change addendum

### Change
Clarified Login Flow Hardening plan status as open/pending so it no longer reads like an implied completed implementation.

### Files added/updated/deleted
- Updated:
  - `plans/login-flow-hardening-execution-plan.md`
  - `plan.md`

### Why
- Plan review identified ambiguity: the login hardening document looked like an execution artifact even though there was no explicit completion marker.
- Adding an explicit status keeps planning docs and rollout records consistent.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Implemented Optimize Route V2 no-preferred-window autoscheduling so flexible visits can be optimized without manually entering planning window times.

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/v2/validation.ts`
  - `backend/src/app/api/optimize-route/v2/validation.test.ts`
  - `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
  - `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### Why
- Route Planner previously blocked optimization for flexible patients without preferred windows, forcing manual time input even when users wanted optimizer-managed placement.
- Backend now accepts flexible visits with blank `windowStart/windowEnd` and schedules them with synthetic full-day bounds, while preserving strict fixed-window validation.
- The planner now allows no-window flexible visits, validates only partial-window mistakes, and renders “No preferred window” in results with no preferred-window lateness warning.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/v2/validation.test.ts src/app/api/optimize-route/v2/optimizeRouteService.test.ts` ✅ (2 files, 36 tests)
  - `npm test -- --run src/app/api/optimize-route/v2/route.test.ts` ✅ (1 file, 8 tests)
  - `npm run lint` ✅
- Frontend:
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅ (1 file, 17 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Deleted the JWT authentication remediation plan document from `plans/`.

### Files added/updated/deleted
- Deleted:
  - `plans/jwt-authentication-remediation-plan.md`
- Updated:
  - `plan.md`

### Why
- You requested removal of the remediation plan document.
- The root plan index was updated to avoid listing a deleted file.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Moved fixed-window duration validation feedback to the patient modal action area so the message appears alongside the Cancel/Save buttons for both create and edit flows.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/patients/PatientFormModal.tsx`
  - `plan.md`

### Why
- The fixed-window duration error should be visible at the point of submission so nurses can immediately understand why save is blocked.
- Keeping this specific error near the action buttons improves clarity while preserving row-level placement for other field-specific errors.

### Verification
- Frontend:
  - `npm test -- --run src/tests/patients/PatientsPage.test.tsx src/tests/patients/patientForm.validation.test.ts` ✅ (2 files, 13 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Added patient-form UI validation (create and edit flows) to block fixed windows shorter than the configured visit duration, with the same detailed message format used in optimize-route validation.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/patients/patientForm.ts`
  - `frontend/src/tests/patients/patientForm.validation.test.ts`
  - `frontend/src/tests/patients/PatientsPage.test.tsx`
  - `plan.md`

### Why
- Nurses can change preferred window and duration in the patient form; invalid fixed windows should be caught immediately in UI instead of surfacing later during route optimization.
- Showing the exact required minutes and patient-specific copy improves correction speed and reduces confusion.

### Verification
- Frontend:
  - `npm test -- --run src/tests/patients/patientForm.validation.test.ts src/tests/patients/PatientsPage.test.tsx` ✅ (2 files, 13 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Updated optimize-route v2 fixed-window validation error copy to include the patient’s actual required visit minutes and append “as per patient’s profile.”

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/v2/validation.ts`
  - `backend/src/app/api/optimize-route/v2/validation.test.ts`
  - `plan.md`

### Why
- The previous message did not show the real required duration, so users could not immediately tell the exact minutes causing validation failure.
- Adding explicit minutes plus profile context makes the error more actionable and understandable in the planner UI.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/v2/validation.test.ts` ✅ (1 file, 19 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Updated Route Planner overlap messaging to count unique overlap pairs and show the overlap warning in desktop review, not only mobile review.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### Why
- The previous overlap counter reported overlapping visits, which showed `2` for a single pair (`A↔B`) and was confusing.
- Overlap warning visibility was mobile-only, so desktop users had no equivalent warning context before optimizing.

### Verification
- Frontend:
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅ (1 file, 15 tests)
  - `npm run lint` ✅

## Latest change addendum

### Change
Added a dedicated execution plan for Route Planner and optimize-route v2 support of flexible patients with no preferred visit windows (no required manual time entry).

### Files added/updated/deleted
- Added:
  - `plans/optimize-route-v2-no-preferred-window-autoscheduling-execution-plan.md`
- Updated:
  - `plan.md`

### Why
- The current planner blocks optimization for flexible patients without windows, which adds avoidable workflow friction.
- A written execution plan is needed before implementation to align contract, validation, scheduler behavior, and UI copy across frontend/backend.

### Verification
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Updated route-task line copy to show expected start time for every patient while preserving late-window warning for late tasks.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### What changed
- Task rows now always include:
  - `Expected start time HH:MM AM/PM` (derived from each task `serviceStartTime`)
- Late tasks additionally include:
  - `Outside preferred window by X min` (in red)
- Updated route-planner test coverage to assert both expected-start-time and outside-window text for a late task.

### Why
- Users requested expected start time visibility for every scheduled patient, not only late tasks.
- Keeping the late-window warning provides conflict context when a task starts after the preferred window ends.

### Verification
- Frontend:
  - `npm run lint` ✅

## Latest change addendum

### Change
Fixed optimized-route expected start-time rendering to use local time conversion from the ISO timestamp, preventing UTC hour display in the Route Planner results panel.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### Why
- The previous formatter extracted `Txx:yy` directly from the ISO string, so UTC timestamps were shown as local clock times (for example showing `01:00 PM` instead of `09:00 AM` in Toronto).
- Parsing as a `Date` and formatting with `Intl.DateTimeFormat` keeps `Expected start time` consistent with locale-aware time rendering already used elsewhere in the planner.
- The updated test now derives its expected label from locale formatting so it remains correct across environments with different timezones.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅ (1 file, 15 tests)

## Latest change addendum

### Change
Updated optimized-route task rows to show expected start time from scheduler output.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### What changed
- Replaced the late-state suffix text with a scheduler-driven expected start-time suffix:
  - `Expected start time HH:MM AM/PM`
- Added formatting helper to derive `HH:MM AM/PM` from each task’s `serviceStartTime`.
- Added/updated route-planner test coverage to assert expected-start-time rendering.

### Why
- Users asked for schedule clarity in the exact task-line format and preferred expected start time over lateness phrasing.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Styled late-task preferred-window warning text in red within route summary rows.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `plan.md`

### What changed
- Updated the `Outside preferred window by X min` segment in route-task rows to render with red text (`text-red-600` / `dark:text-red-400`) when `lateBySeconds > 0`.
- Kept the rest of the task line styling unchanged.

### Why
- The lateness/conflict indicator should stand out visually from neutral route metadata.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Updated route summary wording for late tasks to use user-friendly preferred-window language.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### What changed
- Updated task-row late-state text in optimized route details:
  - from implicit lateness handling
  - to explicit copy: `Outside preferred window by X min` when `lateBySeconds > 0`.
- Added route-planner test coverage to verify the new copy appears for a task with non-zero `lateBySeconds`.

### Why
- “Late” phrasing was less clear in overlapping-window scenarios.
- Preferred-window wording better matches planner intent and is easier for nurses to interpret.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Improved route-planner validation messages by naming the patients that caused window-validation failures.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### What changed
- Added patient-name list formatting for submit-time validation errors.
- Updated missing-window error to include affected patient names.
- Updated invalid window-order error to include affected patient names.
- Updated route-planner tests to assert the new patient-specific validation message.

### Why
- Generic validation copy made it hard for users to identify which selected patient needed a window fix.
- Patient-specific errors reduce confusion and speed up correction.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Cleared the destination patient search input after selecting a patient in Route Planner.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `plan.md`

### What changed
- Updated `addDestinationPatient` to reset `destinationSearchQuery` to an empty string immediately after a patient is added.
- This clears the typed search text so users can quickly search for the next patient without manually deleting prior input.

### Why
- After selecting a destination patient, the search query remained in the input and created friction for adding multiple patients.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Added route-planner trip draft persistence so planning selections survive navigation to `/patients` and back.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `plan.md`

### What changed
- Added a typed local draft model for the route planner and persisted it in browser `localStorage`.
- Hydrated planner state from saved draft on mount, including:
  - start/end address + place IDs
  - end mode
  - selected destination visits and per-visit include/window/save flags
  - selected end-patient state
  - active mobile step
- Added guarded draft parsing to ignore malformed/stale payloads safely.
- Added a remount test to verify selected trip state is restored and can be submitted after returning to route planner.
- Added localStorage cleanup in route-planner test setup/teardown to keep tests isolated.

### Why
- Nurses could lose in-progress trip planning when leaving route planner to add a missing patient.
- Draft persistence removes the need to reselect all destinations after switching pages.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx src/tests/integration/patientsRoutePlanner.integration.test.tsx` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Fixed a mobile route-planner runtime crash by restoring overlap helper state used by the review step summary.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `plan.md`

### What changed
- Restored the missing `windowsOverlap` helper used in overlap computations.
- Restored computed `overlappingVisitCount` for selected request destinations so the mobile review card can render overlap warnings without runtime errors.

### Why
- The mobile review step referenced `overlappingVisitCount` but the corresponding helper/computation was removed, causing `ReferenceError` at runtime.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅

## Latest change addendum

### Change
Allowed overlapping persisted patient visit windows by removing overlap rejection in backend patient payload validation and frontend patient form validation.

### Files added/updated/deleted
- Added:
  - `frontend/src/tests/patients/patientForm.validation.test.ts`
- Updated:
  - `backend/src/lib/patients/patientValidation.ts`
  - `backend/src/lib/patients/patientValidation.test.ts`
  - `frontend/src/components/patients/patientForm.ts`
  - `plan.md`

### What changed
- Removed backend overlap enforcement for `visitWindows` so create/update patient payloads no longer throw on overlapping time windows.
- Kept existing window format and same-day ordering validation (`HH:MM` and `end > start`) unchanged.
- Removed frontend patient form overlap validation errors (`Visit windows must not overlap` and per-row overlap errors) so overlapping windows can be submitted and persisted.
- Added a new frontend test file to assert overlap-allowed behavior in `validateForm` while preserving `end > start` validation.
- Updated backend patient validation test to assert overlapping windows are accepted.

### Why
- Route-planning and persistence behavior now needs to support overlapping visit windows end-to-end, including saved patient records.
- Rejecting overlap at patient save time conflicted with the intended scheduling workflow.

### Verification
- Backend:
  - `npm test -- --run src/lib/patients/patientValidation.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm test -- --run src/tests/patients/patientForm.validation.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Implemented a mobile-focused route planner UX pass with a step-based flow, collapsible destination cards, and a sticky optimize action bar.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/components/responsiveStyles.ts`
  - `plan.md`

### What changed
- Added a mobile step navigator (`Trip`, `Patients`, `Review`) and gated planner sections by active step on small screens.
- Added mobile “continue” actions between steps while keeping desktop fully expanded.
- Added per-destination details toggles so destination cards can collapse/expand their planning-window controls.
- Added mobile review summary card with quick jump-back actions.
- Added sticky mobile optimize footer treatment so the optimize CTA stays reachable while scrolling.
- Kept desktop behavior and optimize payload logic unchanged.

### Why
- The planner form had become too long and dense on phones, which made route setup and optimization harder to complete efficiently.
- A step-based mobile flow and collapsible destination controls reduce cognitive load and scrolling overhead without changing backend contract behavior.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test -- --run src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx src/tests/integration/patientsRoutePlanner.integration.test.tsx` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Wired manual route-planner start and end autocomplete selections to carry Google place ids through the optimize-route request so manual addresses can use place-aware geocoding instead of plain text alone.

### Files added/updated/deleted
- Updated:
  - `shared/contracts/optimizeRoute.ts`
  - `frontend/src/components/RoutePlanner.tsx`
  - `frontend/src/components/routePlanner/useRouteOptimization.ts`
  - `frontend/src/components/routePlanner/routePlannerService.ts`
  - `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
  - `frontend/src/tests/routePlanner/routePlannerService.test.ts`
  - `frontend/src/tests/routePlanner/useRouteOptimization.test.ts`
  - `backend/src/app/api/optimize-route/validation.ts`
  - `backend/src/app/api/optimize-route/validation.test.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.test.ts`
  - `backend/src/app/api/optimize-route/route.test.ts`
  - `plan.md`

### Why
- The route planner already exposed address autocomplete for manual start and end inputs, but it discarded the selected suggestion `placeId` and only sent plain address strings to the backend.
- Forwarding manual place ids lets optimize-route geocode those endpoints with Google Places when available, which avoids failures like the Snow Goose Lane case.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/validation.test.ts src/app/api/optimize-route/optimizeRouteService.test.ts src/app/api/optimize-route/route.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm test -- --run src/tests/routePlanner/routePlannerService.test.ts src/tests/routePlanner/useRouteOptimization.test.ts src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Added a Google Places text-search fallback for route geocoding so manual or legacy addresses without a stored place id can still resolve when Nominatim returns no match.

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/geocoding.ts`
  - `backend/src/app/api/optimize-route/geocoding.test.ts`
  - `plan.md`

### Why
- Some saved patient addresses were entered manually or predated place-id capture, so they still relied on Nominatim-only text geocoding.
- Falling back to Google Places text search makes route optimization more resilient for incomplete-but-real addresses like `6625 snow goose lane`.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/geocoding.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Hardened Google Routes leg parsing to accept stringified `distanceMeters` values so route optimization no longer fails when the distance field arrives in string form.

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/routing.ts`
  - `backend/src/app/api/optimize-route/routing.test.ts`
  - `plan.md`

### Why
- The route parser previously required `distanceMeters` to be a JSON number and threw `Google Routes returned an invalid distance.` for any other shape.
- Accepting numeric strings makes the parser more tolerant of real-world API payloads while keeping invalid non-numeric distance values rejected.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/routing.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Updated route optimization geocoding to prefer stored Google place ids for patient destinations and fall back to text geocoding only when a place-details lookup cannot be resolved.

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/geocoding.ts`
  - `backend/src/app/api/optimize-route/geocoding.test.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.ts`
  - `backend/src/app/api/optimize-route/optimizeRouteService.test.ts`
  - `plan.md`

### Why
- The route optimizer was ignoring `googlePlaceId` even though patient destinations already carry it from address autocomplete, so incomplete street-only addresses could fail text geocoding.
- Using place ids first makes saved patient locations more reliable while preserving the existing Nominatim fallback for addresses that do not have a stored place id.

### Verification
- Backend:
  - `npm test -- --run src/app/api/optimize-route/geocoding.test.ts src/app/api/optimize-route/optimizeRouteService.test.ts` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Expanded the login/signup content to use the full auth card width so the segmented control, headings, fields, and button spread across the same shell width as the header.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/auth/LoginPage.tsx`
  - `plan.md`

### Why
- The previous alignment pass widened the auth card shell, but the inner content was still capped to a narrow centered column and did not visually match the wider container.
- Letting the inner content fill the card keeps the unauthenticated page balanced and makes the login/signup switcher align with the wider shell.

### Verification
- Frontend:
  - `npm test -- --run src/tests/auth/LoginPage.test.tsx src/tests/appRoutes.test.tsx` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Aligned the unauthenticated shell by making the login/signup card span the same outer width as the header while keeping the form controls constrained to a readable inner column.

### Files added/updated/deleted
- Updated:
  - `frontend/src/components/auth/LoginPage.tsx`
  - `plan.md`

### Why
- The header already spans the full app shell width, but the auth card was capped to a much narrower outer width, which made the unauthenticated layout feel visually misaligned.
- Matching the outer card width to the header keeps the page shell consistent without making the login form itself uncomfortably wide.

### Verification
- Frontend:
  - `npm test -- --run src/tests/auth/LoginPage.test.tsx src/tests/appRoutes.test.tsx` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Changed the post-auth frontend landing route so successful login and signup redirect nurses to `/patients` instead of `/route-planner`.

### Files added/updated/deleted
- Updated:
  - `frontend/src/App.jsx`
  - `frontend/src/components/auth/LoginPage.tsx`
  - `frontend/src/tests/auth/LoginPage.test.tsx`
  - `plan.md`

### Why
- The patients workspace is the primary landing page after authentication, so the default protected route and explicit login redirect should both open `/patients`.
- Keeping the default route and login-page navigation aligned avoids inconsistent post-auth behavior across direct login, signup, and root-path navigation.

### Verification
- Frontend:
  - `npm test -- --run src/tests/auth/LoginPage.test.tsx src/tests/appRoutes.test.tsx` ✅
  - `npm run build` ✅
- Repo:
  - `git diff --check` ✅

## Latest change addendum

### Change
Added a frontend Vercel SPA rewrite so browser refreshes on protected routes like `/patients` and `/route-planner` resolve back to the React app instead of returning a hosted `404`.

### Files added/updated/deleted
- Added:
  - `frontend/vercel.json`
- Updated:
  - `frontend/README.md`
  - `DEPLOYMENT.md`
  - `plan.md`

### Why
- The frontend uses `BrowserRouter`, so deep links work inside the client app but need a hosting rewrite for direct page loads and refreshes on Vercel.
- Without the rewrite, Vercel tries to resolve `/patients` as a static file path and returns `404 Not Found` before React can boot.

### Verification
- Frontend:
  - `npm run build` ✅
- Configuration:
  - `python3 -m json.tool frontend/vercel.json` ✅
  - `git diff --check` ✅

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
Added a dedicated remediation plan for the current JWT-auth branch issues covering unsafe migration sequencing, legacy nurse identity preservation, and duplicate-signup race handling.

### Files added/updated/deleted
- Added:
  - `plans/jwt-authentication-remediation-plan.md`
- Updated:
  - `plan.md`

### Why
- The current auth branch needs a concrete follow-up plan before implementation because the first rollout path can break on legacy `nurses` rows, orphan existing patient visibility behind a new nurse id, and surface duplicate-signup races as `500` errors.
- The remediation document captures the recommended phased upgrade path, bootstrap strategy, rollout order, and acceptance criteria in one place under `plans/`.

### Verification
- Documentation-only change.
- Runtime verification not run.

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
Retired the one-time legacy nurse bootstrap tooling and removed stale rollout documentation after the JWT remediation rollout was fully completed.

### Files added/updated/deleted
- Deleted:
  - `backend/scripts/bootstrap-legacy-nurse.mjs`
  - `backend/src/db/bootstrapLegacyNurse.test.ts`
- Updated:
  - `backend/package.json`
  - `backend/.env.local.example`
  - `backend/README.md`
  - `DEPLOYMENT.md`
  - `plan.md`

### Why
- Phase F is deployed and verified, so the one-time bootstrap path is no longer part of the supported runtime or operator workflow.
- Removing the retired command, env vars, and rollout-specific instructions keeps the backend docs aligned with the finalized auth model.

### Verification
- Backend:
  - `npm test` ✅
  - `npm run lint` ✅
- Documentation:
  - `git diff --check` ✅

## Latest change addendum

### Change
Published a short release note for the JWT remediation rollout and marked the remediation plan closed after Phase F was deployed and verified.

### Files added/updated/deleted
- Added:
  - `plans/jwt-authentication-remediation-release-note.md`
- Updated:
  - `plans/jwt-authentication-remediation-plan.md`
  - `plan.md`

### Why
- The remediation work is fully deployed, so the planning docs should now reflect a closed status and provide a concise release summary for future reference.
- Recording the closeout keeps the repository plan log aligned with the production rollout state.

### Verification
- Documentation:
  - `git diff --check` ✅
- Rollout status:
  - Phase F deployed and verified in production ✅ (operator-confirmed)

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
Added a one-time legacy nurse bootstrap command that upgrades the original nurse row in place, preserving patient ownership while preparing upgraded environments for JWT login.

### Files added/updated/deleted
- Added:
  - `backend/scripts/bootstrap-legacy-nurse.mjs`
  - `backend/src/db/bootstrapLegacyNurse.test.ts`
- Updated:
  - `backend/package.json`
  - `backend/.env.local.example`
  - `backend/README.md`
  - `DEPLOYMENT.md`
  - `plan.md`

### Why
- Upgraded environments need an operator-safe way to attach auth credentials to the existing legacy nurse row instead of creating a replacement nurse account with a new `id`.
- The bootstrap command preserves the original nurse id so existing patient rows remain visible after login and gives production rollout docs a concrete step before auth goes live.

### Verification
- Backend:
  - `npm test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Prepared Phase F by adding the final auth-constraint migration (`nurses.email` and `nurses.password_hash` back to `NOT NULL`) and removing the temporary runtime guards that only existed for the transitional null-auth rollout.

### Files added/updated/deleted
- Added:
  - `backend/drizzle/0002_worthless_spirit.sql`
  - `backend/drizzle/meta/0002_snapshot.json`
- Updated:
  - `backend/drizzle/meta/_journal.json`
  - `backend/src/db/schema.ts`
  - `backend/src/app/api/auth/login/route.ts`
  - `backend/src/app/api/auth/me/route.ts`
  - `backend/src/lib/auth/requireAuth.ts`
  - `backend/src/app/api/auth/signup/route.ts`
  - `backend/src/app/api/auth/login/route.test.ts`
  - `backend/src/app/api/auth/me/route.test.ts`
  - `backend/src/lib/auth/requireAuth.test.ts`
  - `backend/README.md`
  - `DEPLOYMENT.md`
  - `plan.md`

### Why
- All durable environments are expected to be backfilled before the final cleanup step, so the schema can once again enforce non-null auth fields at the database layer.
- Removing the transitional null checks simplifies auth runtime behavior and ensures the database, ORM schema, and application assumptions are aligned again.

### Verification
- Backend:
  - `npm test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Deployment note:
  - final migration should only be deployed after `select id, external_key, email, password_hash from nurses where email is null or password_hash is null;` returns zero rows in each durable environment.

## Latest change addendum

### Change
Implemented Phase E signup hardening by mapping database unique-email conflicts to deterministic `409 Conflict` responses, including the concurrent-signup race path.

### Files added/updated/deleted
- Updated:
  - `backend/src/lib/patients/patientRepository.ts`
  - `backend/src/lib/patients/patientRepository.test.ts`
  - `backend/src/app/api/auth/signup/route.ts`
  - `backend/src/app/api/auth/signup/route.test.ts`
  - `plan.md`

### Why
- Signup already returned `409` when a duplicate email was found before insert, but concurrent duplicate requests could still race and surface as generic `500` errors.
- The repository now translates database unique-constraint failures into a dedicated conflict error so the signup route can return the intended `409` consistently.

### Verification
- Production smoke test (unauthenticated):
  - `POST /api/auth/login` with invalid credentials ✅ `401`
  - `GET /api/auth/me` without token ✅ `401`
  - `GET /api/patients` without token ✅ `401`
- Backend:
  - `npm test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

## Latest change addendum

### Change
Reworked the auth schema rollout into a transitional migration by keeping `nurses.email` and `nurses.password_hash` nullable for legacy rows, then hardened auth runtime checks so un-bootstrapped nurse rows are rejected safely.

### Files added/updated/deleted
- Updated:
  - `backend/src/db/schema.ts`
  - `backend/drizzle/0001_useful_skaar.sql`
  - `backend/drizzle/meta/0001_snapshot.json`
  - `backend/src/app/api/auth/login/route.ts`
  - `backend/src/app/api/auth/signup/route.ts`
  - `backend/src/app/api/auth/me/route.ts`
  - `backend/src/lib/auth/requireAuth.ts`
  - `backend/src/app/api/auth/login/route.test.ts`
  - `backend/src/app/api/auth/me/route.test.ts`
  - `backend/src/lib/auth/requireAuth.test.ts`
  - `backend/README.md`
  - `plan.md`

### Why
- The previous auth migration could fail on any upgraded database that already contained legacy `nurses` rows because it added nullable columns and then immediately enforced `NOT NULL`.
- Keeping the auth columns nullable during the transitional phase lets the schema upgrade succeed first, while runtime guards make sure incomplete legacy rows cannot authenticate until the planned bootstrap/backfill step is added.

### Verification
- Backend:
  - `npm test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

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
