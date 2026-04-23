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

The current implementation models template windows as full visit windows:

- `recurring_visit_templates.service_duration_minutes`
- `recurring_visit_template_windows.day_of_week`
- `recurring_visit_template_windows.start_time`
- `recurring_visit_template_windows.end_time`
- `recurring_visit_template_windows.visit_time_type`

The frontend form mirrors this by asking for service duration and recurring windows with day/start/end.

## Target UX

In the client edit form, the recurring template section should show:

1. Template name
2. Start date
3. End date (optional)
4. Active checkbox/toggle
5. Weekday selector

Recommended weekday UI:

- Seven toggle buttons: `Sun Mon Tue Wed Thu Fri Sat`
- At least one weekday required
- Compact summary text on collapsed rows, for example:
  - `Mon, Wed, Fri · starts 2026-05-01`
  - `Mon · active · no end date`

Add helper copy near the weekday selector:

`Visits use this client's saved visit windows and duration.`

Remove from the recurring template UI:

- Service duration input
- Recurring window start input
- Recurring window end input
- Add recurring window button

## Data Model Options

### Preferred Option: New Template Days Table

Create a clearer table:

`recurring_visit_template_days`

Columns:

- `id`
- `template_id`
- `day_of_week`
- `created_at`
- `updated_at`

Constraints/indexes:

- FK `template_id -> recurring_visit_templates.id` with cascade delete
- `day_of_week` check from 0 to 6
- unique `(template_id, day_of_week)`
- index on `template_id`

Then stop using `recurring_visit_template_windows` for template recurrence.

### Compatibility Option: Reuse Existing Windows Table

Keep `recurring_visit_template_windows`, but ignore `start_time`, `end_time`, and `visit_time_type`.

This is less migration work but keeps misleading schema names and dead columns. Prefer the new table unless time is tight.

## Contract Changes

Update shared contracts from window-based templates to day-based templates.

Current shape:

```ts
{
  serviceDurationMinutes: number;
  windows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    visitTimeType: "fixed" | "flexible";
  }>;
}
```

Target shape:

```ts
{
  name: string | null;
  timezone: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  daysOfWeek: number[];
}
```

Keep runtime parsers tolerant during migration if needed:

- Accept old `windows` payload temporarily and convert unique `dayOfWeek` values.
- Emit only `daysOfWeek` from new APIs once frontend is migrated.

## Backend Plan

### Phase 1: Schema Migration

1. Add `recurring_visit_template_days`.
2. Backfill days from existing `recurring_visit_template_windows`:
   - Insert unique `(template_id, day_of_week)` pairs.
3. Keep old columns/tables for one deploy if safer.
4. Later cleanup migration:
   - drop `recurring_visit_template_windows`
   - drop `service_duration_minutes` from `recurring_visit_templates`

### Phase 2: Repository Updates

Update `backend/src/lib/recurrence/recurrenceRepository.ts`:

1. Replace `attachTemplateWindows` with day attachment.
2. Create/update template days instead of windows.
3. Delete old template days and insert replacement days on template update.
4. Expansion logic:
   - load active templates for nurse
   - filter by start/end date
   - filter by selected weekday
   - load active client data and client visit windows
   - generate visit instances from client visit windows

Generated instance fields should come from the patient/client:

- `address`
- `googlePlaceId`
- `windowStart`
- `windowEnd`
- `visitTimeType`
- `serviceDurationMinutes`

Template still supplies:

- `templateId`
- recurrence date
- occurrence grouping identity

### Phase 3: Occurrence Key Strategy

The occurrence key should stay stable and distinguish multiple patient windows on the same day.

Recommended:

```text
<templateId>:<patientVisitWindowId>:<planningDate>
```

Fallback for clients without explicit visit window ids:

```text
<templateId>:default:<planningDate>
```

Important: if patient visit windows change after instances are generated, decide whether existing future generated instances should be regenerated, updated in place, or left as already-materialized schedule rows.

Recommended first version:

- New expansion uses current patient data.
- Existing manually overridden instances are preserved.
- Existing non-manual future instances can be refreshed when a template expands for a date.

### Phase 4: Delete Behavior

When deleting a template:

1. Delete generated visit instances for that template.
2. Delete the template.
3. Route Planner should not show orphaned generated visits.

If any old orphaned instances exist from previous behavior, add a one-time cleanup migration or repository guard.

## Frontend Plan

### Phase 1: Domain Model

Update patient form recurring template state:

- Replace `windows` with `daysOfWeek`.
- Remove `serviceDurationMinutes`.
- Keep stable local row ids for form rendering.

Files likely involved:

- `frontend/src/features/patients/domain/patientForm.ts`
- `frontend/src/features/patients/ui/PatientFormModal.tsx`
- `frontend/src/features/patients/ui/PatientsPage.tsx`
- `frontend/src/features/route-planner/hooks/useCreatePatientForm.ts`

### Phase 2: UI Simplification

In recurring template cards:

1. Remove service duration input.
2. Remove recurring windows nested editor.
3. Add weekday toggle group.
4. Add helper text explaining that visit windows/duration come from client data.
5. Update validation messages.

### Phase 3: API Service Updates

Update:

- `frontend/src/features/patients/api/recurringVisitTemplateService.ts`
- route planner re-export shim if still present

Payload should send `daysOfWeek` instead of `windows`.

### Phase 4: Route Planner

Route Planner should continue consuming concrete visit instances.

No template editing should happen in Route Planner.

Add a defensive filter so instances with a deleted/missing template do not auto-seed selected clients. This protects users if old orphan rows exist in the database.

### Phase 5: Exceptions + Series Editing

Once templates are day-based and visit details come from client records, add occurrence-level and series-level editing without reintroducing duplicate template windows.

Supported actions:

1. Skip one occurrence
2. Restore a skipped occurrence
3. Reschedule one occurrence
4. Edit this template from a chosen date forward
5. End a template before a chosen date

Recommended model:

- Keep `visit_instance_exceptions` or a successor table for occurrence-specific changes.
- Store exceptions by `templateId`, `patientId`, `planningDate`, and optional `patientVisitWindowId`.
- Preserve the distinction between:
  - generated schedule from template + client data
  - manual one-off override
  - future-series template change

Occurrence edit behavior:

- Skip one occurrence:
  - mark the concrete visit instance `cancelled`, or store a skip exception if the instance has not been generated yet.
- Restore one occurrence:
  - remove skip exception or set generated instance back to scheduled when safe.
- Reschedule one occurrence:
  - update that visit instance with `isManualOverride = true`.
  - do not mutate client visit windows or recurring template weekdays.

Series edit behavior:

- Edit this and future:
  - close the current template by setting `endDate` to the day before the effective date.
  - create a new template beginning on the effective date with the new name/date/days/active values.
  - keep client visit windows and duration as the source of visit details.
- End this and future:
  - set `endDate` to the day before the effective date.
  - cancel or delete non-manual generated future instances for that template.

Regeneration rules:

- Do not recreate skipped occurrences.
- Do not overwrite manually rescheduled instances.
- Refresh non-manual future instances from current client visit windows when expansion runs.
- If a client visit window is removed, future non-manual instances derived from that window should be cancelled or removed according to the final product decision.

Frontend surfaces:

- Route Planner can support one-off instance actions such as skip/restore/reschedule.
- Client template editor should support series actions:
  - save entire template
  - apply changes from date forward
  - end template from date forward
- Keep copy explicit so users understand whether they are editing one planned visit or the recurring template.

## Test Plan

### Backend Tests

Update/add tests for:

1. Validation accepts `daysOfWeek`.
2. Validation rejects:
   - no weekdays
   - duplicate weekdays if contract chooses to reject instead of normalize
   - weekdays outside 0-6
3. Create template persists days.
4. Update template replaces days.
5. Expansion generates instances using patient visit windows and duration.
6. Expansion creates multiple instances when a patient has multiple visit windows.
7. Expansion creates no instances when template weekday does not match planning date.
8. Deleting a template removes its generated instances.
9. Skip exceptions prevent regeneration for that occurrence.
10. Rescheduled/manual instances are not overwritten by expansion.
11. Edit-this-and-future closes the old template and creates a replacement template.
12. Ending a series cancels or removes future non-manual generated instances.

### Frontend Tests

Update/add tests for:

1. Patient form renders weekday toggles and no service/window fields in template section.
2. Template creation sends `daysOfWeek`.
3. Template update sends changed `daysOfWeek`.
4. Removing a template calls delete and removes it from local form state.
5. Route Planner auto-seeds from generated visit instances only when their template still exists.
6. One-off skip/restore/reschedule controls affect only the selected occurrence.
7. Series edit controls clearly separate entire-template edits from this-and-future edits.
8. Route Planner does not show skipped occurrences after reload.

## Migration / Rollout Strategy

Recommended rollout:

1. Backend supports both old and new payloads.
2. Add new days table and backfill from old windows.
3. Frontend switches to day-based UI and payload.
4. Verify production data.
5. Remove old window-based template support and schema in a later cleanup.

This avoids a brittle all-at-once migration and gives room to recover if existing template data needs correction.

## Open Questions

1. If a client has multiple visit windows, should each selected weekday generate all windows?
   - Recommended: yes.
2. If a client has no visit windows, should a template still generate a visit?
   - Recommended: yes, using the client-level preferred/default window fields if present; otherwise skip and show a validation warning.
3. Should changing patient visit windows update already-generated future instances?
   - Recommended: refresh non-manual future instances on expansion; preserve manual overrides.
4. Should timezone stay editable per template?
   - Recommended: keep backend timezone for correctness, but consider hiding it in UI and defaulting from nurse/account timezone.

## Acceptance Criteria

1. Recurring template UI no longer asks for service duration, start time, or end time.
2. Template only asks for name, date range, active state, and weekdays.
3. Generated visit instances use patient/client visit windows and duration.
4. Route Planner selected clients match the chosen planning date and active templates.
5. Deleting a template removes or prevents stale generated visits from appearing in Route Planner.
6. Backend and frontend tests pass.
