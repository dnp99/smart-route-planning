# Recurring Visit Templates — Implementation Plan

## Goal

Add recurring visit templates as a first-class feature in client management, generate concrete dated visits from templates, and keep optimizer v2/v3 contracts unchanged by feeding concrete visits into existing planner flows.

## Status Snapshot (2026-04-22)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 — Decision Lock | ✅ Completed | Core implementation choices are reflected in shipped schema/API/frontend behavior; remaining refinements are tracked under later phases. |
| Phase 1 — Data Model + Shared Contracts | ✅ Completed | Backend schema tables + migration and shared template/instance contracts are in place (`backend/src/db/schema.ts`, `backend/drizzle/0014_graceful_odin.sql`, `shared/contracts/patients.ts`). |
| Phase 2 — Backend APIs + Expansion Engine | ✅ Completed | Recurring template CRUD and visit-instance expand/list/patch APIs are implemented, with idempotent expansion and optimizer integration fallback. |
| Phase 3 — Frontend Integration | ✅ Completed | Recurrence authoring + template orchestration in Clients flows and visit-instance hydration in Route Planner are implemented. |
| Phase 3.1 — Planner Auto-Expand + Auto-Preselect | ✅ Completed | Planner now expands first, hydrates date instances, auto-selects by template/day, supports manual override lock, and shows an auto-seed hint in the Clients card header. |
| Phase 4 — Exceptions + Series Editing | ⏳ Not started | Skip/reschedule/edit-future behavior still pending. |
| Phase 5 — Dashboard/History Linkage | ✅ Completed | `visitInstanceId` + `templateId` FKs on `route_optimization_tasks`; template name surfaced on upcoming stops. Requires `db:generate` + `db:migrate`. |

---

## Phase 0 — Decision Lock (before coding)

**Status:** ✅ Completed

Decision points are now locked implicitly by implemented schema, recurrence APIs, expansion behavior, and frontend integration.

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

**Status:** ✅ Completed

### Completed in this phase

- Backend schema tables added in `backend/src/db/schema.ts`:
  - `recurring_visit_templates`
  - `recurring_visit_template_windows`
  - `visit_instances`
  - `visit_instance_exceptions`
- Drizzle migration committed in `backend/drizzle/0014_graceful_odin.sql`.
- Shared template/instance contracts and runtime parsing/guards are present in `shared/contracts/patients.ts`.
- Compatibility constraints were preserved (`/api/patients` and optimizer contracts unchanged).

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

**Status:** ✅ Completed

### Completed in this phase

- Recurring template API routes:
  - `GET /api/recurring-visit-templates`
  - `POST /api/recurring-visit-templates`
  - `PATCH /api/recurring-visit-templates/:id`
  - `DELETE /api/recurring-visit-templates/:id`
- Visit-instance API routes:
  - `POST /api/visit-instances/expand`
  - `GET /api/visit-instances?planningDate=...`
  - `PATCH /api/visit-instances/:id`
- Expansion engine + idempotency:
  - `expandVisitInstancesForNurse(...)` in `backend/src/lib/recurrence/recurrenceRepository.ts`
  - occurrence-key dedupe and unique-violation-safe insert handling.
- Optimizer integration:
  - `listScheduledVisitInstancesForOptimization(...)` maps instances to optimizer visits.
  - v3 route fallback consumes scheduled visit instances when request visits are empty.

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

**Status:** ✅ Completed (current scope)

### Completed in this phase

- Recurring template authoring integrated into Clients form/page/table flows.
- Dedicated recurrence service added (`frontend/src/features/patients/api/recurringVisitTemplateService.ts`) with route-planner re-export shim.
- Route planner now hydrates concrete visit instances by planning date via `GET /api/visit-instances` service flow.
- Optional `visitId` passthrough added to planner destination/optimize payload mapping (non-breaking).
- UX copy/style pass completed for Clients terminology and recurrence clarity.

### Note

Planner-side full recurrence editing remains intentionally out of scope for this phase.

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

## Phase 3.1 — Planner Auto-Expand + Auto-Preselect

**Status:** ✅ Completed

### Goal

Reduce nurse clicks on Route Planner by automatically materializing recurring instances for the selected planning date and preselecting those clients in the planner selection list.

### Implemented behavior

1. On Route Planner load (and whenever `planningDate` changes), call:
   - `POST /api/visit-instances/expand` for that date (idempotent)
   - then `GET /api/visit-instances?planningDate=...`
2. Template-aware selection state in controller:
   - `selectedTemplateId`: `auto | all | <templateId>`
   - template options built from fetched template list + instance counts
3. Auto default on planning date change:
   - resolve planning weekday
   - prefer weekday-matching template (with instances), fallback to all/manual behavior
4. Auto-seed selected clients from filtered scheduled instances:
   - preserves instance windows/types and `visitId` bindings
5. Manual override lock:
   - after add/remove/include toggle, stop auto-reseeding for same date
   - reset lock when date or template changes
6. UI transparency:
   - template dropdown above search list
   - Clients card header hint: `Auto-seeded from <template>`
7. Fallback path:
   - if no matching instances/templates for date, manual search/add flow remains available

### UX constraints

- Auto-selection should feel deterministic and explainable:
  - selected clients should correspond to concrete scheduled instances for the visible planning date
- No hidden mutation side effects:
  - planner must not persist recurrence-derived edits into `patients.visitWindows`
- Keep mobile flow intact (no regressions in stepper behavior).

### Technical touchpoints

- `frontend/src/features/route-planner/hooks/useRoutePlannerController.ts`
- `frontend/src/features/route-planner/hooks/useRoutePlannerDestinations.ts`
- `frontend/src/features/route-planner/state/routePlannerDraft.ts` (if needed for seed guards)
- `frontend/src/features/route-planner/api/routePlannerService.ts` (add expand call helper)
- `backend/src/app/api/visit-instances/expand/route.ts` (reuse existing endpoint; no contract change expected)

### Acceptance criteria

1. ✅ Opening Route Planner for a date with recurring schedule produces selected clients without manual clicking.
2. ✅ Changing planning date rehydrates selection from that date’s concrete instances.
3. ✅ Users can manually add/remove/include-toggle clients and those actions are respected during the session.
4. ✅ Existing optimize route flow (v2/v3 contracts) remains unchanged.
5. ✅ Recurrence + planner tests pass with targeted updates for:
   - expand-before-list load flow
   - auto-seed/template selection behavior
   - manual override lock behavior
   - UI/template integration expectations

---

## Phase 4 — Exceptions + Series Editing

**Status:** ⏳ Not started

Implement and validate:

- Skip one date
- Reschedule one occurrence
- Edit this + future

Ensure regeneration respects exceptions and does not recreate skipped/moved occurrences.

---

## Phase 5 — Dashboard/History Linkage (recommended)

**Status:** ✅ Completed

### What was done

- Schema: added `visitInstanceId` (uuid, nullable FK → `visit_instances.id` SET NULL) and `templateId` (uuid, nullable FK → `recurring_visit_templates.id` SET NULL) to `route_optimization_tasks`.
- `listScheduledVisitInstancesForOptimization` now returns `{ visits, instanceMetaByVisitId }` alongside the optimizer visit array.
- `recordOptimizationRun` accepts optional `instanceMetaByVisitId` and persists `visitInstanceId`/`templateId` per task row.
- v3 optimize-route handler threads instance metadata from expansion into `recordOptimizationRun`.
- `getDashboardSummaryForNurse` resolves template names for the latest run's tasks and surfaces them on `DashboardUpcomingStop` via `templateId`/`templateName` fields.
- Shared contract extended: `DashboardUpcomingStop` has optional `templateId` and `templateName`.
- Frontend dashboard shows a blue pill badge with the template name under each upcoming stop that originated from a recurring template.

### Migration required

Run from `backend/`:

```sh
npm run db:generate
npm run db:migrate
```

---

## Validation Gates

### Backend

**Status:** ⏳ Pending (for upcoming backend phases)

- Recurrence expansion unit tests (including DST transitions)
- Idempotency tests (repeat expansion => no duplicates)
- Auth/ownership tests for template + instance APIs

### Frontend

**Status:** ✅ Passed for current frontend recurrence scope

- Patient form validation tests
- Route planner selection/hydration tests
- Integration tests for patient→planner recurrence flow

### Verification commands

- Frontend: `npm run lint && npm run test && npm run build`
- Backend: `npm run lint && npm run test && npm run build`

Latest frontend verification run for this scope: ✅ lint, ✅ tests, ✅ build.

---

## Recommended Execution Order

1. Schema + contracts
2. Backend template CRUD + expansion service
3. Frontend template UI in Patients
4. Route planner consumes instances
5. Exceptions/edit-series
6. Dashboard linkage hardening
