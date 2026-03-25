# Route Optimizer V3 Refactor Plan

## Status

- Not started
- Owner: TBD
- Last updated: 2026-03-25

## Objective

Refactor `optimize-route/v3` solver code into modular units without changing external behavior, response shape, or optimization outcomes.

## Context

`v3` is implemented and in use behind endpoint/flag routing, but the solver logic is concentrated in one large file:

- `backend/src/app/api/optimize-route/v3/optimizeRouteService.ts`

This increases change risk, makes testing slower to iterate, and makes future solver tuning harder.

## Non-goals

- No algorithm replacement.
- No OR-Tools integration.
- No request/response contract changes.
- No frontend payload changes.

## Success Criteria

1. `v3` behavior parity is maintained for existing tests and key benchmark scenarios.
2. Solver internals are split into focused modules with clear boundaries.
3. `optimizeRouteService.ts` remains as orchestration entrypoint only.
4. Shadow diagnostics and logging behavior stay unchanged.

## Target Module Layout

```text
backend/src/app/api/optimize-route/v3/solver/
  index.ts            # solveRouteWithIls entry
  construct.ts        # seeded greedy construction
  evaluate.ts         # schedule evaluation + penalty + comparison
  localSearch.ts      # relocate/reverse sweep logic
  perturbation.ts     # segment/global perturbations
  postProcess.ts      # trailing-flex and no-window promotion passes
  types.ts            # local solver types
```

## Plan

### Phase 1 — Baseline and Safety Net

1. Capture baseline:
   - Existing `v3` test pass status.
   - Representative scenario outputs (order, lateness, unscheduled, warnings).
2. Add a small parity harness test utility for compare-before/after refactor assertions.

### Phase 2 — Extract Evaluation Core

1. Move pure evaluation functions to `solver/evaluate.ts`:
   - scoring and penalty build
   - schedule evaluation
   - schedule comparison helpers
2. Keep function signatures unchanged at call sites.
3. Run tests after each extraction.

### Phase 3 — Extract Construct + Local Search

1. Move seed constructor logic to `solver/construct.ts`.
2. Move sweep/move operators to `solver/localSearch.ts`.
3. Move perturbation helpers to `solver/perturbation.ts`.
4. Keep constants centralized and imported from one place.

### Phase 4 — Extract Post-Processing Passes

1. Move trailing-flex and no-window promotion passes to `solver/postProcess.ts`.
2. Ensure execution order remains identical to current behavior.

### Phase 5 — Orchestrator Cleanup

1. Create `solver/index.ts` for single solver entrypoint.
2. Reduce `optimizeRouteService.ts` to:
   - request prep
   - solver call
   - output assembly
3. Preserve `algorithmVersion` and shadow logging payload fields.

### Phase 6 — Verification

1. Run full backend tests.
2. Validate parity on known tricky scenarios:
   - fixed-window conflict pressure
   - long idle-gap fill cases
   - preserveOrder true/false
   - lunch overlap behaviors
3. Confirm no API contract changes.

## Risks and Mitigations

- Risk: behavior drift during extraction.
  - Mitigation: incremental extraction with parity assertions and frequent test runs.
- Risk: hidden coupling across helper functions.
  - Mitigation: introduce `solver/types.ts` early and keep import boundaries explicit.
- Risk: refactor takes too long.
  - Mitigation: phase cut points; ship after each green phase.

## Deliverables

1. Modular solver files under `v3/solver/`.
2. Slimmer `optimizeRouteService.ts` orchestration layer.
3. Updated tests/parity utility.
4. Brief migration note in plans/completed once finished.
