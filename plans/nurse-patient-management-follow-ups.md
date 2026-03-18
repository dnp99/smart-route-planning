# Nurse Patient Management Follow-ups

Date noted: 2026-03-12
Last updated: 2026-03-17

## Status

Completed.

This file tracked the follow-up gaps and intentional deviations relative to
`plans/nurse-patient-management-execution-plan.md` so they can be addressed in a later pass.

## Resolved follow-ups

### 1. Route-planner request behavior mismatch

Resolution:

- in patient-end mode, `endAddress` is derived from the selected end patient
- `destinations[]` includes only intermediate selected patients
- the final end patient is no longer automatically injected into optimize destinations

Implementation notes:

- this was implemented in `frontend/src/components/RoutePlanner.tsx`

### 2. Shared optimize-route response contract mismatch

Resolution:

- route planner optimization is standardized on v2 shared contracts (`shared/contracts/optimizeRouteV2.ts`)
- the legacy v1 shared optimize-route contract remains unchanged by design and is no longer the nurse route-planner contract source
- no additional follow-up work is tracked here for the v1 contract shape

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
