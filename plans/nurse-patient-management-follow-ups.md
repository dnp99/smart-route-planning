# Nurse Patient Management Follow-ups

Date noted: 2026-03-12

This file tracks the remaining gaps and intentional deviations relative to
`plans/nurse-patient-management-execution-plan.md` so they can be addressed in a later pass.

## Remaining gaps

### 1. Route-planner request behavior mismatch

The execution plan says that in patient-end mode:

- `endAddress` should come from the selected end patient
- `destinations[]` should contain intermediate selected patients only
- the final end patient should not be automatically included in `destinations[]`

Current implementation:

- `frontend/src/components/RoutePlanner.tsx` appends `selectedEndPatient` to the optimize-route request destinations

Future fix:

- keep `endAddress` derived from the end patient
- submit only intermediate patients in `destinations[]`
- preserve end-patient identity in the optimize response through a separate response-shaping strategy

### 2. Shared optimize-route response contract mismatch

The execution plan locks a stricter shared response shape:

- ordered stops should expose `latitude` and `longitude`
- patient-linked ordered stops should carry required `patientId` and `patientName`
- final-end handling should follow the locked patient-end representation rules

Current implementation:

- `shared/contracts/optimizeRoute.ts` still uses nested `coords`
- patient metadata on route stops is still optional in the shared response contract

Future fix:

- align shared request/response types with the locked execution-plan contract
- update backend shaping and frontend parsing together in one atomic change

## Intentional UX deviation from plan

### Patients page structure

The execution plan described a page with:

- search/list on the left
- persistent create/edit form on the right

Current implementation intentionally uses:

- toolbar with search + add button
- patient table on desktop
- patient cards on mobile
- modal for create/edit

Reason:

- this UX was explicitly requested later and provides a cleaner scalable layout

If strict plan parity is required in the future, update the execution plan to reflect the modal/table approach rather than reverting the UI.
