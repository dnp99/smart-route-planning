# Route Optimizer — Option 3: ILS Solver Plan

## Status

- Complete
- Implemented in production code path via `/api/optimize-route/v3`
- Last updated: 2026-03-25

## Completion Notes

- The ILS strategy is implemented with a seeded greedy constructor plus iterative local-search refinement.
- Frontend supports endpoint switching via `VITE_ENABLE_ILS_OPTIMIZER`.
- Final implementation details differ from the original draft structure (monolithic `v3/optimizeRouteService.ts` instead of `v2/solver/*` modules), which is the reason for the follow-up refactor plan.

## What the current algorithm is

The current algorithm is not a simple greedy nearest-neighbour. It is a **priority-tiered constructive heuristic with 2-step beam lookahead and a gap-filler post-pass** (now with gap window planning in v2.5.4):

1. Each iteration groups remaining visits into priority tiers (already-late fixed → all fixed → already-late flexible → urgent flexible → windowed flexible → unconstrained).
2. Within the top tier, a beam-search lookahead of depth 2 / width 8 scores candidates using `ProjectionScore` (fixedLateCount, fixedLateSeconds, totalLateSeconds, waitSeconds, travelSeconds).
3. When a large gap exists before a fixed anchor, `planGapWindowSequence` builds the full gap sub-route at once using nearest-neighbour with EDF urgency ordering.

The fundamental remaining weakness is the **one-pass constructive nature**: once a visit is placed it is never reconsidered. Local search after construction is what separates a proper VRP solver from a heuristic.

---

## Algorithm choice: Iterated Local Search (ILS) with 2-opt / Or-opt

**Recommendation: seed from the existing greedy construction, then run a time-bounded ILS loop of 2-opt and Or-opt moves.**

### Why not the alternatives

| Option | Reason rejected |
|---|---|
| OR-Tools via WASM | ~20 MB binary, cold-start JIT in serverless, fragile TS/WASM glue, no first-party npm package |
| LKH | Compiled C binary, not usable in serverless TypeScript |
| Simulated Annealing | Viable but quality is very sensitive to cooling schedule tuning; ILS is simpler and comparable at n≤20 |
| Exact solvers (branch-and-bound, MILP) | Worst-case exponential — 10s timeout risk in production |

### Why ILS works here

- With n ≤ 20 stops, the 2-opt neighbourhood has at most n(n−1)/2 = 190 edge-swap candidates. A full sweep takes microseconds.
- Or-opt (relocate 1, 2, or 3 consecutive stops) adds ~3n candidate moves, each O(1) via the prebuilt `TravelDurationMatrix`.
- ILS wraps this in a perturbation/restart loop: accept a local minimum → apply double-bridge perturbation → re-run local search → keep the best feasibility-then-objective result.
- On 20 stops, 50–200 ILS iterations fit within a 500 ms CPU budget, well within the remaining request budget after Google API calls.
- The existing `ProjectionScore` is directly reusable as the ILS cost function — no redesign needed.

---

## Mixed hard/soft constraint model

### Hard constraints (infinite penalty)
- A fixed-window visit that cannot be reached before its `windowEnd` → `unscheduledTasks` with `fixed_window_unreachable`. The existing `detectWindowConflicts` pairwise pre-check runs unchanged before the solver.
- Planning-day overflow (`PLANNING_DAY_END_SECONDS`) → `insufficient_day_capacity` (unchanged).

### Soft constraints (penalty in objective)
- Fixed-window lateness: lexicographically dominant (primary sort key).
- Flexible-window lateness: secondary penalty.
- Lunch block: treated as a phantom stop with zero travel cost inserted at `targetLunchStartSeconds`. The solver does not move it; `evaluateSchedule` pauses the time cursor when it passes the lunch window.
- Working-hours overtime is soft (warning-level), consistent with existing `outside_working_hours` behavior.

### Scalar penalty function for ILS

Convert the existing lexicographic `ProjectionScore` to a scalar:

```
penalty = W_fixed_late_count  * fixedLateCount
        + W_fixed_late_seconds * fixedLateSeconds
        + W_total_late         * totalLateSeconds
        + W_wait               * totalWaitSeconds
        + W_travel             * totalTravelSeconds
```

Weights that preserve lexicographic priority (n ≤ 20, max service ≤ 120 min):
- `W_fixed_late_count = 10_000_000`
- `W_fixed_late_seconds = 1_000`
- `W_total_late = 10`
- `W_wait = 1` (or 0 for "distance" objective)
- `W_travel = 1`

A unit test must verify the penalty function respects `compareScores` ordering on known scenario pairs.

---

## Architecture

### Execution pipeline (unchanged outside the solver call)

```
POST /api/optimize-route/v2
  → parseAndValidateBody()                    [keep]
  → geocodeLocations()                        [keep]
  → buildPlanningTravelDurationMatrix()       [keep]
  → buildTravelSecondsResolver()              [keep]
  → detectWindowConflicts()                   [keep]
  → resolveDepartureContext()                 [keep]
  → [NEW] solveVRP()                          [replaces orderVisitsByWindowDistanceAndDuration]
  → groupVisitsIntoStops()                    [keep]
  → buildDrivingRoute()                       [keep]
  → result assembly / warnings                [keep]
```

### New solver module structure

```
backend/src/app/api/optimize-route/v2/solver/
  index.ts          — public entry: solveVRP(), calls construct then ILS
  construct.ts      — greedy EDF-tiered seeding (extracted from current code, near-verbatim)
  evaluate.ts       — evaluateSchedule(): ordered array → ScheduleEval { penalty, ... }
  localSearch.ts    — twoOptSweep(), orOptSweep()
  perturbation.ts   — doubleBridgePerturbation()
  ils.ts            — ILS main loop with time-limit
```

### Public interface (drop-in replacement)

```typescript
export const solveVRP = (
  visits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  preserveOrder: boolean,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  timeLimitMs?: number,  // default 500
): {
  orderedVisits: VisitWithCoords[];
  unscheduledTasks: UnscheduledTaskV2[];
  lunchSkippedDueToFixed?: boolean;
  diagnostics: {
    penalty: number;
    fixedLateCount: number;
    fixedLateSeconds: number;
    totalLateSeconds: number;
    totalWaitSeconds: number;
    totalTravelSeconds: number;
  };
}
```

Near-identical signature to `orderVisitsByWindowDistanceAndDuration` with one addition: `diagnostics` for shadow-mode comparison and observability.

### ILS loop (ils.ts)

```
bestSolution ← construct(visits)           // greedy seed
bestEval     ← evaluate(bestSolution)
currentSolution ← bestSolution
currentEval  ← bestEval

repeat until timeLimitMs exceeded:
  localSolution ← localSearch(currentSolution)   // 2-opt then Or-opt until no improvement
  localEval     ← evaluate(localSolution)

  if localEval.penalty < bestEval.penalty:
    bestSolution ← localSolution
    bestEval     ← localEval

  if localEval.penalty ≤ currentEval.penalty:
    currentSolution ← localSolution               // accept improvement
  else:
    currentSolution ← perturbate(bestSolution)    // restart from best
    currentEval     ← evaluate(currentSolution)

return bestSolution
```

Deterministic acceptance (no SA-style random acceptance) for reproducibility and debuggability.

### Neighbourhood move feasibility pre-check

Before fully evaluating a 2-opt or Or-opt move, check: does this move cause any fixed-window visit to become unreachable? Check via `TravelDurationMatrix`. Moves that create a clearly dominated state (e.g., fixedLateCount increase + no travel improvement) are skipped. Temporary worsening is still allowed for diversification. This is O(n) per move; all moves together are O(n³) in the worst case at n=20.

### Double-bridge perturbation constraint

The double-bridge operates only on the flexible/unconstrained visit subsequence (blocks between fixed anchors). Fixed-window visits retain their relative order during perturbation, preventing the local search from spending its budget recovering feasibility from a scrambled fixed-anchor ordering.

---

## What to keep vs. replace

### Keep entirely
- `travelMatrix.ts`, `geocoding.ts`, `routing.ts`, `validation.ts`, `route.ts`, `types.ts`
- `detectWindowConflicts()`, `resolveDepartureContext()`, `groupVisitsIntoStops()`, `buildTaskResult()`
- All time/date utilities

### Extract and reuse (move to `solver/evaluate.ts`, unchanged)
- `projectVisit()`
- `scoreProjection()`, `compareScores()`, `addScores()`

### Extract and reuse (move to `solver/construct.ts`, near-verbatim)
- Main loop body of `orderVisitsByWindowDistanceAndDuration` (the EDF-tier constructive pass)

### Delete (replaced by ILS)
- `evaluateFutureBestScore()` — beam lookahead replaced by actual local search
- `maybeSelectGapFiller()` — Or-opt structurally handles the same case
- `planGapWindowSequence()` — Or-opt makes this unnecessary
- Note: keep the EDF-tier dispatch in `construct.ts` for seed generation; scalar penalty is used in `evaluate.ts` + ILS search, not as a full replacement for seed logic.

Net change: `optimizeRouteService.ts` loses ~450 lines; gains a `solveVRP()` call. Solver module adds ~350 lines across 5 focused files.

---

## Time budget

| Phase | Budget |
|---|---|
| Geocoding (Google API) | ~1,000–2,000 ms |
| Travel matrix (Google API) | ~1,000–2,000 ms |
| ILS solver | 300–600 ms (configurable via `timeLimitMs`) |
| Final route polylines (Google API) | ~1,000–2,000 ms |
| **Total** | well within 6 s |

The `timeLimitMs` is checked with `performance.now()` at the top of every ILS iteration. Target is consistent sub-second CPU for n ≤ 20, verified with benchmarks on representative scenarios (not assumed from asymptotics alone).

---

## Migration strategy

### Step 0 — Feature flag first (endpoint split)

Roll out ILS behind a frontend-controlled endpoint flag before any solver cutover logic.

- FF OFF (default): frontend calls existing `POST /api/optimize-route/v2` (current greedy behavior).
- FF ON: frontend calls new `POST /api/optimize-route/v3` (ILS engine path).
- Keep request/response contract compatible with v2 in the first iteration so the frontend render path does not fork.
- Do not multiplex solver choice inside one endpoint for initial rollout. Endpoint split keeps rollback instant and low-risk.

Frontend flag behavior:

```typescript
const optimizeRoutePath = isIlsEnabled ? "/api/optimize-route/v3" : "/api/optimize-route/v2";
```

`isIlsEnabled` source (choose one and keep it stable):
- `VITE_ENABLE_ILS_OPTIMIZER=true|false` (build-time env), or
- runtime-injected config (for no-redeploy toggles).

Acceptance criteria for Step 0:
- With FF OFF, request payloads and responses are unchanged from today.
- With FF ON, only endpoint path changes; UI parsing and rendering remains unchanged.
- Turning FF OFF is an immediate rollback to known-good behavior.

### Step 1 — Backend v3 wiring

Implement `POST /api/optimize-route/v3` as the ILS route. Keep `/v2` untouched.

- `/v2`: existing `orderVisitsByWindowDistanceAndDuration` flow.
- `/v3`: new `solveVRP` flow.
- Shared validation/contracts remain in `shared/contracts` to prevent frontend divergence.

### Step 2 — Shadow mode (v3-internal, optional)

Inside `/v3`, optionally run both algorithms and log comparison while returning the selected engine result for that endpoint:

```typescript
const greedyResult = orderVisitsByWindowDistanceAndDuration(...);
const ilsResult    = solveVRP(..., 500);

if (ilsResult.diagnostics.penalty < greedyPenalty) {
  console.info("[solver-shadow] ILS improved", { delta, fixedLateCountGreedy, fixedLateCountIls });
}
// return endpoint-selected result to caller
```

### Step 3 — Test suite parity

Before shadow mode, all existing tests must pass against both code paths. Add a test utility that runs the same scenario through both and asserts ILS is no worse on fixed-window violations and penalty:
`ils.diagnostics.fixedLateCount <= greedyFixedLateCount` and `ils.diagnostics.penalty <= greedyPenalty` on parity scenarios.

Audit the test file for index-based ordering assertions (e.g. "Patient A is at index 2") — these should be relaxed to property assertions ("no fixed window violation") before cutover.

### Step 4 — Cutover

After 2 weeks of shadow logs showing ILS equal-or-better on all constraint dimensions, flip the frontend FF default to ON for targeted cohorts, then globally. Keep `/v2` available until stable.

---

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| ILS degrades a scenario where greedy was already optimal | ILS is seeded from the greedy solution — it can only improve or match. If time limit is hit with no improvement, the greedy seed is returned. Shadow mode provides pre-cutover evidence. |
| Cold-start eats into ILS budget | `timeLimitMs` is checked per-iteration via `performance.now()`. Even 5 iterations improve over single-pass greedy at n≤20. |
| Double-bridge disrupts fixed-window ordering | Perturbation is constrained to the flexible subsequence between fixed anchors. |
| Scalar penalty collapses lexicographic priority | Weight magnitudes ensure no amount of travel reduction compensates for one additional fixed violation. Unit test verifies against `compareScores` on known pairs. |
| Lunch block interacts unexpectedly with Or-opt | Lunch is not a moveable visit — it is a time-block evaluated inside `evaluateSchedule()`. Or-opt only moves `VisitWithCoords` items. |
| Move filtering over-prunes neighbourhood and blocks escapes | Only reject obviously dominated moves; allow controlled temporary worsening to keep ILS effective. |
| Test suite tied to specific greedy orderings | Audit and relax index-based assertions before cutover. |

---

## Algorithm version

New version string: `v3.0.0-ils`

Current version (for reference): `v2.5.4-edf-tier`
