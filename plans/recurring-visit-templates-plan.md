# Recurring Visit Templates — Implementation Plan

## Goal

Add recurring visit templates as a first-class feature in client management, generate concrete dated visits from templates, and keep optimizer v2/v3 contracts unchanged by feeding concrete visits into existing planner flows.

---

## Phase 0 — Decision Lock (before coding)

1. Canonical timezone for recurrence evaluation (nurse/org timezone).
2. DST behavior (deterministic handling for ambiguous/nonexistent local times).
3. Edit semantics:
   - Edit one occurrence
   - Edit this + future
   - Edit entire template
4. Persistence strategy: templates generate concrete visit instances.
5. Generation horizon policy (e.g., rolling next 8–12 weeks).
6. Backfill policy (default: no retroactive generation unless explicit).

---

## Phase 1 — Data Model + Shared Contracts

### Schema additions (`backend/src/db/schema.ts`)

- `recurring_visit_templates`
- `recurring_visit_template_windows`
- `visit_instances`
- `visit_instance_exceptions` (or overrides)

Keep `patients.visitWindows` as patient-level defaults (do not overload for recurrence templates).

### Shared contract changes (`shared/contracts`)

- Extend `shared/contracts/patients.ts` (or introduce dedicated contracts and export in `shared/contracts/index.ts`) to include template/instance shapes.
- Keep `shared/contracts/optimizeRouteV2.ts` unchanged for compatibility.

### Migration workflow (mandatory)

1. Update schema in `backend/src/db/schema.ts`
2. `cd backend && npm run db:generate`
3. `npm run db:migrate`

---

## Phase 2 — Backend APIs + Expansion Engine

### New API surfaces

- `GET /api/recurring-visit-templates`
- `POST /api/recurring-visit-templates`
- `PATCH /api/recurring-visit-templates/:id`
- `DELETE /api/recurring-visit-templates/:id`
- `POST /api/visit-instances/expand` (idempotent)
- `GET /api/visit-instances?planningDate=...`
- `PATCH /api/visit-instances/:id` (single occurrence edits/cancels)

### Core backend rule

Recurrence is expanded before optimizer services. Keep existing optimizer contracts untouched:

- `backend/src/app/api/optimize-route/v2/route.ts`
- `backend/src/app/api/optimize-route/v3/route.ts`
- `shared/contracts/optimizeRouteV2.ts`

Map `visit_instances` to existing optimizer `visits[]` payload shape.

### Idempotency

Use stable occurrence identity + DB unique constraints so repeated expansion cannot create duplicates.

---

## Phase 3 — Frontend Integration

### Primary authoring UX (patient management)

- `frontend/src/features/patients/ui/PatientFormModal.tsx`
- `frontend/src/features/patients/domain/patientForm.ts`
- `frontend/src/features/patients/api/patientService.ts`

### Client list recurrence summary

- `frontend/src/features/patients/ui/PatientsTable.tsx`

### Route planner behavior

Planner consumes concrete visit instances; avoid full recurrence editing in planner.

Touchpoints:

- `frontend/src/features/route-planner/domain/routePlannerHelpers.ts`
- `frontend/src/features/route-planner/hooks/useRoutePlannerController.ts`
- `frontend/src/features/route-planner/hooks/useRoutePlannerDestinations.ts`
- `frontend/src/features/route-planner/domain/routePlannerTypes.ts`
- `frontend/src/features/route-planner/state/routePlannerDraft.ts`

Important: replace/reconcile recurrence handling in:

- `frontend/src/features/route-planner/api/routePlannerService.ts`

Do not persist recurrence-derived edits back as plain `visitWindows`.

---

## Phase 4 — Exceptions + Series Editing

Implement and validate:

- Skip one date
- Reschedule one occurrence
- Edit this + future

Ensure regeneration respects exceptions and does not recreate skipped/moved occurrences.

---

## Phase 5 — Dashboard/History Linkage (recommended)

Add links from optimization history to instance/template identifiers where useful:

- `backend/src/lib/dashboard/dashboardRepository.ts`
- related schema/contract updates

---

## Validation Gates

### Backend

- Recurrence expansion unit tests (including DST transitions)
- Idempotency tests (repeat expansion => no duplicates)
- Auth/ownership tests for template + instance APIs

### Frontend

- Patient form validation tests
- Route planner selection/hydration tests
- Integration tests for patient→planner recurrence flow

### Verification commands

- Frontend: `npm run lint && npm run test && npm run build`
- Backend: `npm run lint && npm run test && npm run build`

---

## Recommended Execution Order

1. Schema + contracts
2. Backend template CRUD + expansion service
3. Frontend template UI in Patients
4. Route planner consumes instances
5. Exceptions/edit-series
6. Dashboard linkage hardening
