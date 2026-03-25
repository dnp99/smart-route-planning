# Plan: Optimization Objective Selector

**Branch:** `feature/menu`
**Status:** Completed

## Completion summary

This work is implemented in the repository end-to-end.

- Backend accepts and defaults `optimizationObjective` (`"time" | "distance"`) and uses it in score comparison.
- Frontend sends `optimizationObjective` to `/api/optimize-route/v2`.
- Objective selection UI is implemented in **Account Settings** (route settings tab), and the selected value is threaded into Route Planner via authenticated user state.

## Context

Nurses currently have no control over how the route optimizer scores candidates — it always minimizes travel seconds as a tiebreaker after lateness/wait. The nurse wants to choose between:

1. **Shortest time** — finish all visits as early as possible, regardless of driving distance or zigzag route
2. **Shortest distance** — minimize driving (current behavior, remains the default)

## Algorithm behavior (implemented)

Current `compareScores` priority (in `optimizeRouteService.ts`):

> fixed violations → lateness → wait seconds → **travel seconds**

For **"time" mode**, the last two tiebreakers are replaced with a single combined `(totalWaitSeconds + totalTravelSeconds)` comparison. This minimizes total schedule overhead (idle + driving), so the nurse finishes as early as possible.

For **"distance" mode**: no change (current behavior).

## Implemented files

### 1. `shared/contracts/optimizeRouteV2.ts`

- Includes `optimizationObjective?: "time" | "distance"` in `OptimizeRouteV2Request`
- `isOptimizeRouteV2Request` validates objective values:
  ```ts
  if (
    payload.optimizationObjective !== undefined &&
    payload.optimizationObjective !== "time" &&
    payload.optimizationObjective !== "distance"
  ) {
    return false;
  }
  ```

### 2. `backend/src/app/api/optimize-route/v2/validation.ts`

- Includes objective parser helper with default:
  ```ts
  const parseOptimizationObjective = (value: unknown): "time" | "distance" => {
    if (value === "time") return "time";
    return "distance"; // default
  };
  ```
- `parseAndValidateBody` parses and returns `optimizationObjective`:
  ```ts
  const optimizationObjective = parseOptimizationObjective(payload.optimizationObjective);
  // ...add optimizationObjective to returned object
  ```

### 3. `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`

- `compareScores` accepts `objective: "time" | "distance"` and applies objective-aware scoring:
  ```ts
  const compareScores = (left, right, objective) => {
    // fixed violations + lateness unchanged...
    if (objective === "time") {
      return (
        left.totalWaitSeconds +
        left.totalTravelSeconds -
        (right.totalWaitSeconds + right.totalTravelSeconds)
      );
    }
    // "distance" (default): existing wait → travel priority
    if (left.totalWaitSeconds !== right.totalWaitSeconds)
      return left.totalWaitSeconds - right.totalWaitSeconds;
    return left.totalTravelSeconds - right.totalTravelSeconds;
  };
  ```
- Objective is threaded through all relevant comparison call sites:
  - `compareVisitProjections` (~line 641)
  - `compareGapFillerCandidates` (~line 677)
  - inline sort at ~line 603 (lookahead)
- Objective is threaded from route optimization entrypoint via validated request payload

### 4. `frontend/src/components/routePlanner/routePlannerService.ts`

- Includes `optimizationObjective?: "time" | "distance"` in request input typing
- `requestOptimizedRoute` conditionally includes objective in request body:
  ```ts
  ...(optimizationObjective === "time" ? { optimizationObjective: "time" } : {}),
  ```

### 5. `frontend/src/components/hooks/useRouteOptimization.ts`

- Includes `optimizationObjective?: "time" | "distance"` in hook input
- Passes objective through to `requestOptimizedRoute`

### 6. `frontend/src/components/RoutePlanner.tsx`

- Accepts `optimizationObjective` as a prop and passes it to both `optimizeRoute(...)` calls
- Receives `optimizationObjective` from authenticated app state (`App.jsx`)

### 7. Objective selector UI (implemented in account settings)

- `frontend/src/components/modals/AccountSettingsModal.tsx`
  - Renders the two-option selector in the Route settings tab:
    - `"distance"` → **Less driving**
    - `"time"` → **Finish sooner**
- `frontend/src/components/hooks/useAccountSettings.ts`
  - Persists selection via `updateOptimizationObjective(...)`
- `frontend/src/components/auth/authService.ts`
  - Sends `PATCH /api/auth/me` with `{ optimizationObjective }`
- `backend/src/app/api/auth/me/route.ts`
  - Validates and persists objective value on the nurse profile
- `frontend/src/App.jsx`
  - Reads `authUser.optimizationObjective` and passes it to `RoutePlanner`

### 8. `frontend/src/components/responsiveStyles.ts`

Includes selector style tokens:

```ts
objectiveSelectorGroup: "flex gap-3 sm:gap-4",
objectiveSelectorOption: "flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50/50 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:border-blue-800 dark:has-[:checked]:bg-blue-950/30",
objectiveSelectorLabel: "text-xs font-semibold text-slate-800 dark:text-slate-100",
objectiveSelectorDescription: "mt-0.5 text-xs text-slate-500 dark:text-slate-400",
```

## Prop threading summary

```
AccountSettingsModal.tsx (UI selector)
  → useAccountSettings.ts
  → authService.updateOptimizationObjective
  → PATCH /api/auth/me
  → nurse.optimizationObjective persisted
  → App.jsx reads authUser.optimizationObjective
  → RoutePlanner.tsx prop
  → useRouteOptimization (hook input)
  → routePlannerService (request body)
  → POST /api/optimize-route/v2
  → validation.ts (parse, default "distance")
  → optimizeRouteService.ts (compareScores objective switch)
```

## Verification evidence in repo

1. Frontend service test covers objective payload forwarding:
   - `frontend/src/tests/routePlanner/routePlannerService.test.ts`
   - `includes optimizationObjective in request body when set to 'time'`
2. Backend validation and route handler tests assert parsed objective default behavior (`"distance"`) in request pipeline:
   - `backend/src/app/api/optimize-route/v2/validation.test.ts`
   - `backend/src/app/api/optimize-route/v2/route.test.ts`
3. Runtime code path includes objective-aware scoring switch in:
   - `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
