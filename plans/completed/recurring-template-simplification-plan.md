# Recurring Template Simplification Plan

## Goal

Simplify recurring templates so they describe only recurrence membership and date range. Visit timing and duration should come from the existing client/patient visit settings.

This removes duplicate fields from recurring templates:

- Template-level service duration
- Template-level visit window start time
- Template-level visit window end time
- Template-level visit time type

The simplified template should contain only:

- Template name
- Template start date
- Template end date (optional)
- Active/inactive state
- Days of the week
- Timezone, if still needed for recurrence evaluation

## Product Rationale

Patients already have visit duration, visit type, and visit windows. Duplicating those fields in recurring templates creates two sources of truth and makes it unclear which values the route planner should use.

After this change:

- Client profile owns visit details.
- Recurring template owns recurrence schedule.
- Generated visit instances combine both:
  - recurrence date/day from template
  - address/window/type/duration from client

## Current State

~~The current implementation models template windows as full visit windows:~~

~~- `recurring_visit_templates.service_duration_minutes`~~
~~- `recurring_visit_template_windows.day_of_week`~~
~~- `recurring_visit_template_windows.start_time`~~
~~- `recurring_visit_template_windows.end_time`~~
~~- `recurring_visit_template_windows.visit_time_type`~~

~~The frontend form mirrors this by asking for service duration and recurring windows with day/start/end.~~

**DONE.** Templates now own only recurrence schedule (`daysOfWeek`, dates, timezone, active). The `recurring_visit_template_windows` table and `service_duration_minutes` column have been dropped.

## Target UX

**DONE.** The client edit form shows:

1. Template name
2. Start date
3. End date (optional)
4. Active checkbox/toggle
5. Weekday selector — seven toggle buttons `Sun Mon Tue Wed Thu Fri Sat`, at least one required
6. Helper text: "Visits use this client's saved visit windows and duration."

Service duration input, recurring window start/end inputs, and the add-window button have been removed.

## Data Model Options

**DONE — Preferred Option implemented.** `recurring_visit_template_days` table created with:

- `id`, `template_id` (FK → recurring_visit_templates, cascade delete), `day_of_week` (0–6), `created_at`, `updated_at`
- Unique index on `(template_id, day_of_week)`
- Backfilled from `recurring_visit_template_windows` at migration time
- `recurring_visit_template_windows` table subsequently dropped

## Contract Changes

**DONE.** Shared contract updated:

- `RecurringVisitTemplate`: removed `serviceDurationMinutes`, `daysOfWeek` is now required (not optional)
- `CreateRecurringVisitTemplateRequest`: removed `serviceDurationMinutes`
- Runtime parser `isRecurringVisitTemplate`: validates `daysOfWeek` as required

## Backend Plan

### Phase 1: Schema Migration — DONE

- [x] Added `recurring_visit_template_days` (migration `0017_recurring_template_days.sql`)
- [x] Backfilled days from existing windows
- [x] Dropped `recurring_visit_template_windows` table (migration `0017_previous_tombstone.sql`)
- [x] Dropped `service_duration_minutes` from `recurring_visit_templates`

### Phase 2: Repository Updates — DONE

- [x] `attachTemplateSchedule` reads from `recurring_visit_template_days` only
- [x] Create writes `daysOfWeek` to days table; does not write windows
- [x] Update replaces days; does not touch windows table
- [x] Expansion loads active templates, filters by `daysOfWeek`, loads client visit windows and duration, generates instances from client data
- [x] Validation accepts `daysOfWeek`; `serviceDurationMinutes` removed from template payload
- [x] DTO emits `daysOfWeek`; `serviceDurationMinutes` removed from template response

### Phase 3: Occurrence Key Strategy — DONE

Occurrence key uses `<templateId>:<patientVisitWindowId>:<planningDate>` (or `<templateId>:default:<planningDate>` via the legacy fallback window id). Implemented in `recurrenceRepository.ts`.

### Phase 4: Delete Behavior — DONE

Deleting a template cascades to delete its generated visit instances (FK on `visit_instances.template_id` with `ON DELETE cascade` is not present — deletion is handled explicitly in `deleteRecurringVisitTemplateForNurse` which deletes instances then the template in a transaction).

### Backend Tests — DONE

Covered in `backend/src/lib/recurrence/recurrenceRepository.test.ts` and `backend/src/lib/recurrence/recurrenceValidation.test.ts`:

1. [x] Validation accepts `daysOfWeek`, rejects empty array and out-of-range values
2. [x] Create template persists days to `recurring_visit_template_days`
3. [x] Update template replaces days
4. [x] Expansion generates instances using client visit windows and duration
5. [x] Expansion creates multiple instances when client has multiple visit windows
6. [x] Expansion skips dates where template weekday does not match
7. [x] Deleting a template removes generated visit instances
8. [x] No-window-client fallback (uses legacy `preferredVisitStartTime`/`preferredVisitEndTime`)

## Frontend Plan

### Phase 1: Domain Model — DONE

- [x] `PatientFormRecurringTemplate`: replaced `windows`/`serviceDurationMinutes` with `daysOfWeek: number[]`
- [x] `FormFieldErrors`: removed window-related errors, added `daysOfWeek?: string`
- [x] `createEmptyRecurringTemplate`: emits `daysOfWeek: [1]` (Monday default)
- [x] `buildRecurringTemplateMutationPlan`: sends `daysOfWeek`, no `windows` or `serviceDurationMinutes`
- [x] `validateForm`: validates `daysOfWeek.length > 0`, removed window/duration validation
- [x] `toRecurringFormTemplate`: reads `template.daysOfWeek` with fallback to extracting from old `windows`

### Phase 2: UI Simplification — DONE

- [x] Removed service duration input from template cards
- [x] Removed recurring windows nested editor
- [x] Added weekday toggle group (7 buttons, `aria-pressed`, blue selected state per design system §11)
- [x] Added helper text "Visits use this client's saved visit windows and duration."
- [x] Updated validation messages

### Phase 3: API Service Updates — DONE

- [x] `patientForm.ts` re-export barrel cleaned up (removed `createEmptyRecurringTemplateWindow`, `PatientFormRecurringTemplateWindow`, `RecurringTemplateWindowFieldErrors`)
- [x] `useCreatePatientForm.ts`: removed window handler functions
- [x] `PatientsPage.tsx`: removed window handler functions and props

### Phase 4: Route Planner — DONE

- [x] `templateOptions` `matchesPlanningDay` reads `daysOfWeek` instead of removed `windows`
- [x] `autoTemplateId` reads `daysOfWeek`
- [x] Defensive filter: instances whose `templateId` is null or not in the loaded `recurringTemplates` set are excluded from auto-seeding

### Phase 5: Exceptions + Series Editing — DONE

Add occurrence-level and series-level editing.

Supported actions:

1. Skip one occurrence
2. Restore a skipped occurrence
3. Reschedule one occurrence
4. Edit this template from a chosen date forward
5. End a template before a chosen date

Recommended model:

- Use `visit_instance_exceptions` or successor table for occurrence-specific changes
- Store exceptions by `templateId`, `patientId`, `planningDate`, optional `patientVisitWindowId`
- Distinguish: generated schedule / manual one-off override / future-series template change

Occurrence edit behavior:

- Skip: mark instance `cancelled`, or store skip exception if not yet generated
- Restore: remove skip exception or set instance back to `scheduled`
- Reschedule: update instance with `isManualOverride = true`; do not mutate template or client windows

Series edit behavior:

- Edit this and future: set `endDate` on current template to day before effective date; create new template from effective date with updated values
- End this and future: set `endDate`; cancel/delete non-manual future instances (**implemented as cancellation for generated non-manual scheduled instances when template `endDate` is shortened via `updateRecurringVisitTemplateForNurse`**)

Regeneration rules:

- Do not recreate skipped occurrences
- Do not overwrite manually rescheduled instances
- Refresh non-manual future instances on expansion
- If a client visit window is removed, cancel derived non-manual future instances

Frontend surfaces:

- Route Planner: one-off instance actions (skip / restore / reschedule)
- Client template editor: series actions (save entire template / apply from date forward / end from date forward)

## Test Plan

### Backend Tests — DONE

See Backend Plan → Backend Tests above.

### Frontend Tests — DONE

- [x] `patientForm.validation.test.ts` updated: fixtures use `daysOfWeek`, removed window-duration test, added "requires at least one weekday" test
- [x] Template creation sends `daysOfWeek` (integration test)
- [x] Template update sends changed `daysOfWeek`
- [x] Route Planner defensive filter excludes orphaned instances (unit/integration test, including null-template and unknown-template orphans)
- [x] Phase 5 UI tests (skip/restore/reschedule in Route Planner; series split when template start date moves forward)

### Remaining Phase 5 scope

- [x] Explicit client-template editor action for "end from date forward"
- [x] Exception persistence model (`visit_instance_exceptions`) for non-generated/ungenerated occurrence edits, with repository persistence in `updateVisitInstanceForNurse` and expansion application in `expandVisitInstancesForNurse`
- [x] Expansion regeneration rules for client window changes (refresh non-manual future instances; preserve manual overrides)

## Migration / Rollout Strategy

**COMPLETE.** Rolled out in two migrations:

1. `0017_recurring_template_days.sql` — added days table, backfilled, kept old windows table
2. `0017_previous_tombstone.sql` — dropped windows table and `service_duration_minutes`

Backend accepted both old `windows` payload and new `daysOfWeek` payload during transition. Frontend now sends only `daysOfWeek`.

## Open Questions

1. ~~If a client has multiple visit windows, should each selected weekday generate all windows?~~ **Yes — implemented.**
2. ~~If a client has no visit windows, should a template still generate a visit?~~ **Yes — uses legacy `preferredVisitStartTime`/`preferredVisitEndTime` fallback.**
3. ~~Should changing patient visit windows update already-generated future instances?~~ **Yes — implemented. Expansion now refreshes non-manual scheduled instances and cancels stale derived non-manual scheduled instances when they no longer match template/client windows.**
4. Should timezone stay editable per template? **Yes — kept in backend and form. Hidden complexity deferred.**
