# Plan: Optimization Objective Selector

**Branch:** `feature/menu`
**Status:** Pending implementation

## Context

Nurses currently have no control over how the route optimizer scores candidates — it always minimizes travel seconds as a tiebreaker after lateness/wait. The nurse wants to choose between:

1. **Shortest time** — finish all visits as early as possible, regardless of driving distance or zigzag route
2. **Shortest distance** — minimize driving (current behavior, remains the default)

## Algorithm change

Current `compareScores` priority (in `optimizeRouteService.ts`):
> fixed violations → lateness → wait seconds → **travel seconds**

For **"time" mode**, replace the last two tiebreakers with a single combined `(totalWaitSeconds + totalTravelSeconds)` comparison. This minimizes total schedule overhead (idle + driving), so the nurse finishes as early as possible.

For **"distance" mode**: no change (current behavior).

## Files to modify

### 1. `shared/contracts/optimizeRouteV2.ts`
- Add `optimizationObjective?: "time" | "distance"` to `OptimizeRouteV2Request` type
- In `isOptimizeRouteV2Request` validator, add:
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
- Add helper:
  ```ts
  const parseOptimizationObjective = (value: unknown): "time" | "distance" => {
    if (value === "time") return "time";
    return "distance"; // default
  };
  ```
- In `parseAndValidateBody`, extract and include in return:
  ```ts
  const optimizationObjective = parseOptimizationObjective(payload.optimizationObjective);
  // ...add optimizationObjective to returned object
  ```

### 3. `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- Update `compareScores` to accept `objective: "time" | "distance"`:
  ```ts
  const compareScores = (left, right, objective) => {
    // fixed violations + lateness unchanged...
    if (objective === "time") {
      return (left.totalWaitSeconds + left.totalTravelSeconds) -
             (right.totalWaitSeconds + right.totalTravelSeconds);
    }
    // "distance" (default): existing wait → travel priority
    if (left.totalWaitSeconds !== right.totalWaitSeconds)
      return left.totalWaitSeconds - right.totalWaitSeconds;
    return left.totalTravelSeconds - right.totalTravelSeconds;
  };
  ```
- Thread `objective` through all `compareScores` callers:
  - `compareVisitProjections` (~line 641)
  - `compareGapFillerCandidates` (~line 677)
  - inline sort at ~line 603 (lookahead)
- Thread from `buildOptimizedRoute` (reads `optimizationObjective` from `ValidatedOptimizeRouteV2Request`)

### 4. `frontend/src/components/routePlanner/routePlannerService.ts`
- Add `optimizationObjective?: "time" | "distance"` to `OptimizeRouteRequestInput`
- In `requestOptimizedRoute`, include in request body:
  ```ts
  ...(optimizationObjective === "time" ? { optimizationObjective: "time" } : {}),
  ```

### 5. `frontend/src/components/hooks/useRouteOptimization.ts`
- Add `optimizationObjective?: "time" | "distance"` to `OptimizeRouteInput`
- Pass through to `requestOptimizedRoute`

### 6. `frontend/src/components/RoutePlanner.tsx`
- Add state:
  ```ts
  const [optimizationObjective, setOptimizationObjective] = useState<"time" | "distance">("distance");
  ```
- Pass to both `optimizeRoute(...)` calls
- Pass `optimizationObjective` + `onSetOptimizationObjective` as props to `PatientSelectorSection`

### 7. `frontend/src/components/routePlanner/PatientSelectorSection.tsx`
- Add props: `optimizationObjective: "time" | "distance"`, `onSetOptimizationObjective: (v: "time" | "distance") => void`
- Render a two-option radio group just above the optimize button using style tokens
- Labels:
  - `"time"` → **Shortest time** · "Covers all patients quickly, may zigzag"
  - `"distance"` → **Shortest distance** · "Efficient driving (default)"

### 8. `frontend/src/components/responsiveStyles.ts`
Add tokens:
```ts
objectiveSelectorGroup: "flex gap-3 sm:gap-4",
objectiveSelectorOption: "flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50/50 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:border-blue-800 dark:has-[:checked]:bg-blue-950/30",
objectiveSelectorLabel: "text-xs font-semibold text-slate-800 dark:text-slate-100",
objectiveSelectorDescription: "mt-0.5 text-xs text-slate-500 dark:text-slate-400",
```

## Prop threading summary

```
RoutePlanner.tsx (state + setter)
  → PatientSelectorSection (UI selector)
  → useRouteOptimization (hook input)
  → routePlannerService (request body)
  → POST /api/optimize-route/v2
  → validation.ts (parse, default "distance")
  → optimizeRouteService.ts (compareScores objective switch)
```

## Verification

1. `npm run lint` from `frontend/` — no errors
2. `npm run test` from `frontend/` — all pass (existing tests use default "distance" behavior; no test changes expected)
3. Manual — select **Shortest time**, optimize a multi-patient route: visits should pack tightly in time, potentially accepting a longer drive
4. Manual — **Shortest distance** gives same result as before this change
