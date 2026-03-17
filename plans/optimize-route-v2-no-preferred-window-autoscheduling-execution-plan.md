# Optimize Route V2 No-Preferred-Window Autoscheduling Execution Plan

Date: 2026-03-17

## Objective

Allow nurses to optimize routes for flexible patients who have no preferred visit window, without requiring manual start/end window entry in Route Planner.

## Problem Statement

Current planner behavior blocks optimization when a selected destination has no visit window:

- frontend enforces manual time entry before submit
- backend requires `windowStart` and `windowEnd` for all visits

This creates unnecessary user friction and breaks flow when the nurse just wants the optimizer to place a flexible visit where it best fits.

## Desired Behavior

For flexible visits with no preferred window:

1. Nurse can include patient and optimize immediately.
2. Optimizer schedules the visit using the normal scoring logic (travel, waiting, fixed-window protection).
3. Nurse can still optionally set an override planning window.
4. Optional “save window to patient record” remains available only when nurse explicitly provides a window.

## Scope

### In scope

- optimize-route v2 request/validation support for no-window flexible visits
- scheduler semantics for no-preferred-window tasks
- Route Planner UX change from required input to optional override
- test updates across shared contracts, frontend, and backend

### Out of scope

- changing behavior for fixed windows
- changing overlap policy (overlapping persisted windows remain allowed)
- introducing hard business-hours constraints in this phase

## Recommended Technical Approach

## Contract and Validation

Keep fixed-window requirements strict, but relax flexible requirements:

- `windowType: "fixed"`:
  - `windowStart` and `windowEnd` required (unchanged)
- `windowType: "flexible"`:
  - `windowStart` and `windowEnd` optional
  - if one is provided, both must be provided
  - if both omitted, treat as “no preferred window”

Add explicit task metadata so UI can render intent clearly:

- `hasPreferredWindow: boolean` on task result (or equivalent flag)
- when false, window display can use “No preferred window” copy

## Scheduler Semantics

For flexible tasks with no preferred window:

- assign internal synthetic bounds for optimization only:
  - start of planning day to end of planning day (for example `00:00` to `23:59`)
- do not persist synthetic bounds to patient data
- exclude synthetic-window tasks from departure anchor selection
- departure fallback when no anchored tasks exist:
  - use provided `start.departureTime` if present
  - otherwise use a configurable default local start (recommended: `08:00` in request timezone)

This keeps route construction deterministic while avoiding midnight leave-time artifacts.

## Frontend UX

Route Planner behavior for no-window flexible destinations:

- remove submit blocker requiring manual time entry
- replace required prompt with informational copy:
  - “No preferred window. Optimizer will auto-schedule this visit.”
- provide optional “Set planning window” controls (collapsed by default on mobile)
- keep “Save this window to patient record” visible only after a full manual window is entered

Result panel behavior:

- always show expected start time from optimized task
- show preferred-window status:
  - with window: `windowStart - windowEnd`
  - without window: `No preferred window`
- suppress “Outside preferred window” warning for no-preferred-window tasks

## Data and Persistence Rules

- no-window optimization does not create patient visit windows
- persistence occurs only when nurse explicitly opts to save a manually entered window
- existing patient windows continue to behave unchanged

## Execution Phases

## Phase 1: Shared Contract and Validation

1. Update shared optimize-route v2 types/guards for optional flexible windows.
2. Update backend validation logic with strict fixed vs flexible rules.
3. Add validation tests for:
   - fixed with missing windows (reject)
   - flexible with both missing (accept)
   - flexible with one missing (reject)

## Phase 2: Scheduler Normalization and Departure Rules

1. Normalize no-window flexible visits to synthetic full-day bounds internally.
2. Exclude synthetic windows from departure anchor selection.
3. Add fallback departure default when all windows are synthetic.
4. Add service tests for:
   - mixed fixed + no-window flexible ordering
   - all no-window flexible requests
   - expected start/service timings and late metrics

## Phase 3: Route Planner UX

1. Remove missing-window submit validation blocker.
2. Update no-window destination copy and optional override controls.
3. Gate “save window” action to explicit user-entered windows.
4. Add frontend tests for no-window happy path and optional override path.

## Phase 4: Result Presentation and Message Clarity

1. Render “No preferred window” in task row when applicable.
2. Keep expected start time always visible.
3. Hide preferred-window lateness warning for no-window tasks.
4. Add UI tests for task-line copy in both preferred and no-preferred cases.

## Acceptance Criteria

1. Nurse can optimize route with flexible no-window patients without entering times.
2. Fixed-window behavior and validation remain unchanged.
3. Leave-by suggestion does not default to midnight when no anchored windows exist.
4. No-window tasks appear with clear “No preferred window” messaging in results.
5. All affected tests pass in frontend and backend.

## Testing Strategy

### Backend

- `validation.test.ts`:
  - optional windows for flexible visits
  - fixed-window strictness unchanged
- `optimizeRouteService.test.ts`:
  - mixed-window scheduling
  - all-flexible-no-window scheduling
  - departure fallback behavior

### Frontend

- `RoutePlanner.patientSelection.test.tsx`:
  - no blocking error for no-window flexible visit
  - optimize request payload for no-window flow
  - optional override + persistence toggle behavior
- result rendering tests:
  - expected start time + no preferred window copy
  - no outside-window warning for no-window tasks

## Risks and Mitigations

1. Risk: synthetic full-day windows may hide “day too full” scenarios.
   - Mitigation: keep existing unscheduled and lateness metrics, and add explicit tests for capacity edge cases.
2. Risk: departure suggestion quality drops when no anchored windows exist.
   - Mitigation: use fixed configurable default start (08:00 local) and evaluate telemetry.
3. Risk: ambiguous UI between preferred vs non-preferred flexible visits.
   - Mitigation: add explicit status label and distinct copy in both planner and result panel.

## Rollout Notes

1. Bump algorithm version string after scheduler semantics update.
2. Monitor first-week logs for:
   - no-window visit request volume
   - fixed-window violation counts
   - distribution of first-stop expected start times
3. If needed, tune fallback departure default via config.

## Implementation Checklist

- [ ] Phase 1 contract and validation complete
- [ ] Phase 2 scheduler normalization complete
- [ ] Phase 3 planner UX complete
- [ ] Phase 4 result copy complete
- [ ] tests and lint green
- [ ] `plans/change-log.md` updated at rollout completion
