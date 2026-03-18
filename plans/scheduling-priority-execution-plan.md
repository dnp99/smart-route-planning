# Scheduling Priority + Conflict Detection Execution Plan

## Status

- Phase 1: Implemented
- Phase 2: Implemented
- Phase 3: Pending
- Last updated: 2026-03-18

## Objective

Introduce a patient-priority model into the route optimizer so that fixed-window patients are scheduled first and lateness is bounded by patient type. Add pre-optimization conflict detection so nurses are warned about unresolvable window clashes before a route is generated.

This plan is independent of Phase 4 (working-hours schedule). Both can be delivered in either order, but this plan has no dependency on Phase 4 being done first.

## Problem Statement

The current optimizer uses a nearest-neighbor algorithm that picks the geographically closest unvisited stop at each step, regardless of whether that stop has a time constraint. This causes two issues:

1. **Fixed patients get displaced by flexible or no-window patients.** If a no-window patient happens to be the closest stop from the starting point, it goes first — even when a fixed-window patient could be served on time if visited sooner.

2. **Two fixed patients with the same window both end up late.** Because the algorithm does not prioritize fixed patients, neither may be served within its window when a simpler fixed-first ordering would have kept at least one on time.

### Concrete example

Given: Ravi R (fixed 09:00–10:00), Deep P (fixed 09:00–10:00), Jing Su (no window).

Current result:

- Jing Su first (nearest from home) → Ravi R 33 min into window (OK) → Deep P 50 min past window close (violation)

Optimal result under priority model:

- Ravi R or Deep P first → one patient on time → other ~17 min past window close → Jing Su anytime

## Proposed Priority Model

| Patient type | Scheduling priority | Max lateness tolerance |
| --- | --- | --- |
| Fixed window | Highest | 15 min past window close |
| Flexible (has preferred window) | Medium | 60 min past window close |
| No preferred window | Lowest | Anytime |

Lateness is measured from the **window close time**, not the window open time.

## Scheduling Rules

### Rule 1: Fixed-first ordering

Before applying travel-distance optimization, anchor fixed-window patients into the schedule in window-open order. No-window and flexible patients fill the gaps around them.

### Rule 2: Lateness tolerance enforcement

If the optimizer cannot schedule a fixed patient within 15 min of its window close, it must try alternative orderings before accepting the violation. If no ordering resolves it, the route is still produced but the violation is surfaced prominently.

### Rule 3: Conflict detection before optimization

Before running the optimizer, scan for fixed-window patients whose windows overlap and cannot both be satisfied given realistic travel time between them. Surface a warning to the nurse before the route is generated.

### Rule 4: No-window patients fill gaps only

No-window patients are slotted into available time between fixed stops. They never displace or delay a fixed patient. They may also be placed before the first fixed stop if there is sufficient gap time.

### Rule 5: Flexible patients defer to fixed

Flexible patients (with a preferred window but not fixed) are scheduled after fixed patients are placed. If a flexible patient cannot be served within 60 min of its window close, a soft warning is shown — not an error.

## Conflict Detection Logic

Two fixed patients conflict if:

```text
travel_time(A, B) > window_close(A) - window_open(B)
```

where A is visited first and B is visited second. If this holds in both orderings (A→B and B→A), the windows are unresolvable.

### Conflict warning behavior

- Shown before the optimize button submits the request, or returned in the API response alongside the route result.
- Message format: `[Patient A] and [Patient B] have overlapping fixed windows. Only one can be served on time.`
- Route is still generated — the nurse can proceed with awareness.
- The patient that ends up late shows the existing `Outside preferred window by X min` indicator.

## Algorithm Changes

### Current approach

Greedy nearest-neighbor from the current position at each step. No awareness of time windows during stop selection.

### Proposed approach

1. **Pre-sort fixed patients** by window open time.
2. **Anchor fixed patients** into time slots: for each fixed patient in window-open order, find the earliest feasible position in the schedule that satisfies travel time from the previous stop.
3. **Insert no-window patients** into gaps between anchored fixed stops, using nearest-neighbor within each gap.
4. **Insert flexible patients** into remaining gaps, preferring positions that minimize lateness against their preferred window.
5. **Run existing leg geometry + travel time resolution** after the stop order is determined (unchanged).

This preserves the existing Google Routes API integration for actual road distances and does not change the response shape.

## API Behavior

### Conflict warnings in response

Add an optional `warnings` array to the optimize-route-v2 response:

```ts
type ScheduleWarning = {
  type: "window_conflict" | "fixed_late" | "flexible_late";
  patientIds: string[];
  message: string;
};
```

- `window_conflict` — two fixed patients whose windows cannot both be satisfied.
- `fixed_late` — a fixed patient that will be more than 15 min past its window close.
- `flexible_late` — a flexible patient that will be more than 60 min past its window close.

No breaking change to the existing response shape — `warnings` is additive.

### No change to request shape

The existing optimize-route-v2 request already carries visit window and visit type data. No new fields needed.

## Frontend Behavior

### Warning banner

If the response includes one or more warnings, show a dismissible banner above the route result listing each conflict with patient names.

### Per-stop indicators

The existing `Outside preferred window by X min` indicator remains. The color/severity can be upgraded:

- Fixed patient late by > 15 min: red, prominent.
- Flexible patient late by > 60 min: amber.
- Within tolerance: existing green expected-start-time display.

## Out of Scope

- Changing the visit window data model (no schema migrations needed).
- Multi-day scheduling.
- Working-hours integration (covered separately in Phase 4 of the account settings plan).
- Automatic rescheduling suggestions for conflicting patients.

## Implementation Phases

### Phase 1: Fixed-first ordering in optimizer

- Backend: update optimize-route-v2 scheduling logic to anchor fixed patients before inserting flexible and no-window patients.
- No frontend changes.
- Acceptance criteria:
  - Fixed patients are always visited before no-window patients when doing so does not increase lateness for any fixed patient.
  - No-window patients fill gaps, not lead the route when fixed patients are pending.

### Phase 2: Lateness tolerance + fixed_late / flexible_late warnings

- Backend: after computing the schedule, evaluate each stop against its window close + tolerance.
- Add `warnings` array to response for `fixed_late` and `flexible_late` violations.
- Frontend: show warning banner when `warnings` is present in the response.
- Acceptance criteria:
  - Fixed patient more than 15 min late → `fixed_late` warning in response.
  - Flexible patient more than 60 min late → `flexible_late` warning in response.
  - Warning banner renders above the route result with patient names.

### Phase 3: Pre-optimization conflict detection

- Backend: before running the optimizer, check all fixed-patient pairs for unresolvable window overlap given estimated travel time.
- Add `window_conflict` warnings to response for conflicting pairs.
- Frontend: conflict warning distinguishes between pre-route conflicts and post-route lateness.
- Acceptance criteria:
  - Two fixed patients with the same window and non-trivial travel time between them produce a `window_conflict` warning.
  - Warning is shown before the nurse reads the stop-by-stop result.
  - Route is still generated and usable.

## Test Plan

### Backend tests

- Fixed patient is scheduled before a closer no-window patient when doing so keeps it within window.
- Two fixed patients with overlapping windows: one is on time, other is as close as possible to its window.
- No-window patient is never the cause of a fixed patient violation.
- `fixed_late` warning is emitted when fixed patient exceeds 15 min tolerance.
- `flexible_late` warning is emitted when flexible patient exceeds 60 min tolerance.
- `window_conflict` is detected for two fixed patients with the same window.
- No warnings emitted when all patients are within tolerance.

### Frontend tests

- Warning banner renders when `warnings` is present.
- Warning banner is dismissible.
- Per-stop late indicator uses correct severity color based on patient type and lateness amount.
- No banner when `warnings` is absent or empty.

## Rollout Notes

- Phase 1 is the highest-value change and can ship independently.
- Phase 2 requires Phase 1 to be meaningful (lateness values are only accurate once ordering is correct).
- Phase 3 can ship alongside Phase 2 or after.
- No database migrations required for any phase.
- Update `plans/change-log.md` after each completed phase.
