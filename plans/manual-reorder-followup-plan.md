# Manual Stop Reorder — Follow-up Work

Tracks remaining bugs, test gaps, and improvements identified during PR review of the manual stop reorder feature (`feature/menu`). Items in this plan were deferred from the initial implementation to keep the PR focused.

---

## Bug #5 — Recalculate Silently Drops Previously Unscheduled Visits

### Description

When the optimizer returns a result with unscheduled tasks (e.g. a visit that couldn't fit in the day), those visits are absent from `manuallyOrderedStops`. When the nurse then reorders and hits "Recalculate times", `handleRecalculateManualOrder` builds its destination list from `manuallyOrderedStops` only — the previously unscheduled visits are not re-submitted.

There is no user-visible warning when `destinationsInManualOrder.length` is less than the full set of included destinations.

### Files

- `frontend/src/components/RoutePlanner.tsx` — `handleRecalculateManualOrder`
- `frontend/src/components/routePlanner/OptimizedRouteResult.tsx` — stale banner (where to show warning)

### Acceptance Criteria

- When recalculating a manual order, if any included destinations are absent from the stop list (previously unscheduled), the nurse sees a visible notice (e.g. inline text in the stale banner: "X visit(s) from the previous result were unscheduled and will be re-submitted.")
- The re-submission still includes those previously unscheduled visits so the backend can attempt to schedule them in the new order

### Implementation Notes

- Compare `selectedDestinations.filter(d => d.isIncluded).length` against `destinationsInManualOrder.length` before calling `optimizeRoute`
- Re-add missing destinations by appending them at the end of the `destinationsInManualOrder` array (or, preferably, from `result.unscheduledTasks` mapped back through `selectedDestinations`)
- Surface the count in the `isManualOrderStale` banner in `OptimizedRouteResult.tsx`

---

## Test Gap A — Multi-Task Stop in `estimateStops`

### Description

`useManualReorder.test.ts` only uses single-task stops. The `estimateStops` inner task loop advances `stopCursorMs` sequentially across multiple tasks at the same stop. No test exercises a stop with `tasks.length > 1` to confirm that the cursor advances correctly across tasks and that subsequent stop arrival times are correct.

### Files

- `frontend/src/tests/routePlanner/useManualReorder.test.ts`

### Acceptance Criteria

- A test with a stop containing two tasks asserts that:
  - Each task's `serviceStartTime` and `serviceEndTime` are sequential (second starts after first ends)
  - The following stop's arrival time accounts for both tasks' service durations

---

## Test Gap B — No-Coords Cursor Advancement

### Description

When `getStopCoords` returns `null`, `estimateStops` now advances `cursorMs` by `stop.durationFromPreviousSeconds * 1000` and returns the original stop. No test verifies this behaviour — a regression (e.g. removing the cursor advance) would go undetected.

### Files

- `frontend/src/tests/routePlanner/useManualReorder.test.ts`

### Acceptance Criteria

- A test includes a stop with no coords (omit `coords` or set to `null`) between two stops that do have coords
- Asserts that the stop after the no-coords stop receives a later `arrivalTime` than the stop before it (i.e. cursor was not frozen)

---

## Test Gap C — Weak "Clears on Result Change" Assertion

### Description

The existing test `"clears manual order when optimization result changes"` (`useManualReorder.test.ts`) replaces the result with a new object that has the same `orderedStops` as the first result. The test asserts `manualOrder` is null and `orderedStops[0]` is `stop-1` — both of which would be true even if the `useEffect` reset never fired, because the order was the same.

### Files

- `frontend/src/tests/routePlanner/useManualReorder.test.ts`

### Acceptance Criteria

- Rewrite the test so the second result has `orderedStops` in a different order than the manual order applied in the first result
- Assert that after the result change, `orderedStops` reflects the new result's original order (not the previous manual order)

---

## Non-Blocking Improvements

### N1 — Comment: `formatWindowStartMs` windowEnd omission

`useManualReorder.ts` — add a comment on `formatWindowStartMs` noting that clamping to `windowEnd` is intentionally omitted because times are marked as approximate (`~` prefix) and the recalculate call resolves exact lateness.

### N2 — Comment: `AVERAGE_DRIVE_SPEED_KM_PER_HOUR`

`useManualReorder.ts` — add a comment on the constant cross-referencing the Phase 4 nurse-configurable travel speed preference so it is not forgotten.

### N3 — `manualOrder` internal state export

`useManualReorder.ts` — `manualOrder` is exported from the hook's return value and consumed only in tests. Add a JSDoc `@internal` comment or replace the test assertion with a behavioural check on `orderedStops` order instead.
