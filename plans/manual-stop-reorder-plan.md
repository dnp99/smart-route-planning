# Manual Stop Reordering — Execution Plan

## Status

- In progress
- Phase 1: Mostly complete (refactor foundations landed; `RoutePlanner.tsx` still above 900 lines)
- Phase 2: Implemented
- Phase 3: Implemented
- Phase 4: Partially implemented (arrow controls + stale banner + recalculate; drag-and-drop pending)
- Last updated: 2026-03-19

## Objective

Allow nurses to manually reorder optimized route stops after optimization due to
unforeseen circumstances (patient availability, traffic, personal preference).
Reordering shows approximate recalculated times client-side; a "Recalculate" CTA
re-hits the backend with the nurse's chosen order preserved.

## Scope

- Post-optimize only — reordering is not available before the route is optimized.
- Start and end (Home) stops are always fixed; only intermediate patient stops are movable.
- Drag-and-drop (desktop) + up/down arrow buttons (mobile + accessibility).
- Client-side time approximation via Haversine distance (same 40 km/h factor as backend).
- Backend `preserveOrder: true` flag to recalculate times without reordering.
- `RoutePlanner.tsx` refactored into smaller components as part of this work.

---

## Phase 1 — Refactor RoutePlanner.tsx

`RoutePlanner.tsx` is ~1772 lines. Before adding more, extract logical slices into
their own files. This is preparatory work only — no behaviour changes.

### 1a. Extract utility functions → `routePlanner/routePlannerResultUtils.ts`

Move out of `RoutePlanner.tsx`:

- `BREAK_GAP_THRESHOLD_MINUTES`
- `expectedStartTimeFormatter` (Intl instance)
- `formatExpectedStartTimeText(serviceStartTime: string): string`
- `formatBreakGap(minutes: number): string`
- `formatVisitDurationMinutes(minutes: number): string`

These are pure functions with no component state dependency.

### 1b. Extract draft persistence → `routePlanner/routePlannerDraft.ts`

Move out of `RoutePlanner.tsx`:

- `RoutePlannerDraft` type
- `parseSelectedPatientDestination(value: unknown): SelectedPatientDestination | null`
- `readRoutePlannerDraft(): RoutePlannerDraft | null`
- `persistRoutePlannerDraft(draft: RoutePlannerDraft): void`
- `clearRoutePlannerDraft(): void`

`ROUTE_PLANNER_DRAFT_STORAGE_KEY` moves with them.

### 1c. Extract the result section → `routePlanner/OptimizedRouteResult.tsx`

Extract the entire "Optimized Route" card (~600 lines of JSX) into its own component.
This includes:

- Google Maps button
- Distance / Estimated Time metric cards
- Leave-by suggestion banner
- Warnings section (conflicts + lateness)
- RouteMap
- Start / End endpoint cards
- Ordered stop list (delegated to `OptimizedStopList` — see 1d)
- Unscheduled tasks section

Props:
```ts
type OptimizedRouteResultProps = {
  result: OptimizeRouteResponse;
  warningsDismissed: boolean;
  onDismissWarnings: () => void;
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  // reorder props added in Phase 2
};
```

### 1d. Extract the stop list → `routePlanner/OptimizedStopList.tsx`

Extract the `<ol>` of ordered stops from `OptimizedRouteResult`:

- Break card rendering
- Per-stop `<li>` with task cards and ending-point card
- In Phase 2: drag-and-drop and arrow controls added here

Props:
```ts
type OptimizedStopListProps = {
  orderedStops: OrderedStop[];
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  // reorder props added in Phase 2
};
```

### 1e. Extract the stop task card → `routePlanner/OptimizedStopCard.tsx`

Extract the per-task card (collapsed + expanded) from `OptimizedStopList`:

- Patient name button
- Expected start time
- Late / outside window line
- Expanded details (address, window, type, duration)
- Distance/duration from previous stop line

Props:
```ts
type OptimizedStopCardProps = {
  task: TaskResultV2;
  stop: OrderedStop;
  isExpanded: boolean;
  onToggle: () => void;
};
```

### Phase 1 acceptance criteria

- [ ] `RoutePlanner.tsx` is under 900 lines
- [x] All existing behaviour preserved (no regressions)
- [x] `routePlannerResultUtils.ts` and `routePlannerDraft.ts` created
- [x] `OptimizedRouteResult`, `OptimizedStopList`, `OptimizedStopCard` components created

---

## Phase 2 — Backend: preserveOrder flag

Add support for re-optimizing with visits in a caller-specified order.

### 2a. Shared contracts — `shared/contracts/optimizeRouteV2.ts`

Add `preserveOrder?: boolean` to `OptimizeRouteV2Request`:

```ts
export type OptimizeRouteV2Request = {
  planningDate: string;
  timezone: string;
  start: { ... };
  end: { ... };
  visits: OptimizeRouteV2Visit[];
  preserveOrder?: boolean; // NEW
};
```

### 2b. Backend validation — `backend/src/app/api/optimize-route/v2/validation.ts`

Parse and pass through `preserveOrder`:
- Optional boolean, defaults to `false` when absent or not a boolean.

### 2c. Backend service — `optimizeRouteService.ts`

In `orderVisitsByWindowDistanceAndDuration`, add a fast path:

```ts
if (request.preserveOrder) {
  // Skip beam search entirely — return visits in input order
  return { orderedVisits: visits, unscheduledTasks: [] };
}
```

When `preserveOrder: true` the algorithm version suffix could be
`v2.5.1-edf-tier/preserved` to distinguish in analytics.

### Phase 2 acceptance criteria

- [x] `POST /api/optimize-route/v2` with `preserveOrder: true` returns stops in input order
- [x] `preserveOrder: false` (or absent) behaves exactly as before
- [x] Existing tests pass; add one test: fixed input order is preserved in output

---

## Phase 3 — Frontend: manual reorder state

### 3a. New hook — `routePlanner/useManualReorder.ts`

Manages all reorder state. Takes `result: OptimizeRouteResponse | null`.

```ts
type ManualReorderState = {
  // null = original optimizer order
  manualOrder: string[] | null; // stopIds in nurse's order
  isStale: boolean;             // true when nurse has moved anything
  reorderedStops: OrderedStop[]; // stops in nurse's order with estimated times
  moveStop: (stopId: string, direction: "up" | "down") => void;
  onDragEnd: (event: DragEndEvent) => void; // @dnd-kit
  resetOrder: () => void;
};
```

Resets to `null` whenever `result` changes (new optimization clears manual order).

### 3b. Haversine time estimation

When `manualOrder` is set, recompute estimated arrival/service times for every stop:

```
departureMs = new Date(result.start.departureTime).getTime()
cursorMs    = departureMs

for each stop in reorderedStops:
  distKm      = haversine(prevCoords, stop.coords)
  travelSec   = (distKm / 40) * 3600
  arrivalMs   = cursorMs + travelSec * 1000
  serviceMs   = arrivalMs + (task.waitSeconds if window hasn't passed)
  cursorMs    = serviceMs + task.serviceDurationMinutes * 60 * 1000
```

Haversine formula uses `coords` already present on each `OrderedStop`.
The estimation mirrors the backend fallback (`ESTIMATED_DRIVE_SPEED_KM_PER_HOUR = 40`).

Estimated times are stored as `estimatedServiceStartMs: number` on each reordered stop.
The original `OrderedStop` shape is not mutated — estimated times are a parallel overlay.

### 3c. Install @dnd-kit

```
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Phase 3 acceptance criteria

- [x] `useManualReorder` hook returns correct reordered stops and estimated times
- [x] Moving a stop up/down updates `manualOrder` and recalculates times
- [x] `isStale` is `true` after any move, `false` after reset or new optimization
- [x] Hook resets when `result` changes

---

## Phase 4 — Frontend: reorder UI

### 4a. Drag-and-drop in OptimizedStopList

Wrap the `<ol>` in `<DndContext>` + `<SortableContext>` from `@dnd-kit`.
Each intermediate stop `<li>` becomes a `<SortableItem>`.

- Drag handle: a `⠿` (grip) icon on the left side of each stop card, visible on hover.
- Home stop (isEndingPoint) is excluded from sortable items and stays anchored at the bottom.
- `onDragEnd` from `useManualReorder` updates the order.

### 4b. Up/Down arrow buttons in OptimizedStopCard

Add two small icon buttons (▲ / ▼) to each intermediate stop card:

- Always visible on mobile; visible on hover on desktop.
- First stop: ▲ disabled. Last intermediate stop: ▼ disabled.
- Calls `moveStop(stopId, "up" | "down")`.
- These work independently of drag-and-drop — both are always available.

### 4c. Stale time display

When `isStale === true`:
- Replace "Expected start time HH:MM AM" with "~ HH:MM AM" in muted/italic style.
- Add a `~` prefix to make clear times are estimates.

### 4d. Stale banner + Recalculate CTA

When `isStale === true`, show a banner above the stop list:

```
ⓘ  Route manually adjusted — times are estimated.
   [Reset order]   [Recalculate times]
```

- **Reset order**: calls `resetOrder()` from the hook, restores original optimizer order.
- **Recalculate times**: calls `optimizeRoute(...)` with `preserveOrder: true` and
  `visits[]` in the nurse's current manual order. This gets accurate travel times from
  the backend without reordering.

### 4e. routePlannerService.ts — pass preserveOrder

Add `preserveOrder?: boolean` to `OptimizeRouteRequestInput` and include it in the
POST body when `true`.

### 4f. useRouteOptimization.ts — expose preserveOrder

Add `preserveOrder?: boolean` to `OptimizeRouteInput` and pass through to service.

### Phase 4 acceptance criteria

- [ ] Drag-and-drop reorders stops on desktop; grip handle visible on hover
- [x] Up/Down arrows reorder stops on mobile and desktop
- [x] Home stop cannot be moved
- [x] Times show `~` prefix when `isStale === true`
- [x] Stale banner appears after first manual move
- [x] "Reset order" restores original optimizer order and clears stale state
- [x] "Recalculate times" hits backend with `preserveOrder: true` in nurse's order
- [x] After recalculate, stale banner clears, accurate times are shown, manual order is preserved

---

## File map

### New files

| File | Purpose |
|------|---------|
| `frontend/src/components/routePlanner/routePlannerResultUtils.ts` | Pure result formatting helpers |
| `frontend/src/components/routePlanner/routePlannerDraft.ts` | Draft read/write/parse |
| `frontend/src/components/routePlanner/OptimizedRouteResult.tsx` | Full result card component |
| `frontend/src/components/routePlanner/OptimizedStopList.tsx` | Sortable stop list |
| `frontend/src/components/routePlanner/OptimizedStopCard.tsx` | Single stop task card |
| `frontend/src/components/routePlanner/useManualReorder.ts` | Reorder state + Haversine estimation |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/components/RoutePlanner.tsx` | Delegates optimization result/reorder behaviors to extracted route planner components and hook |
| `frontend/src/components/routePlanner/routePlannerService.ts` | Add `preserveOrder` to request |
| `frontend/src/components/routePlanner/useRouteOptimization.ts` | Add `preserveOrder` to input |
| `shared/contracts/optimizeRouteV2.ts` | Add `preserveOrder?: boolean` to request type |
| `backend/src/app/api/optimize-route/v2/validation.ts` | Parse `preserveOrder` |
| `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts` | Fast path when `preserveOrder: true` |

---

## Implementation order

1. Phase 1 — Refactor (no behaviour change, safe to ship independently)
2. Phase 2 — Backend preserveOrder (needed before Recalculate CTA works)
3. Phase 3 — useManualReorder hook + Haversine logic
4. Phase 4 — Drag-and-drop UI + arrow buttons + stale banner
