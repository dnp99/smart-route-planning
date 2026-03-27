# V3 ILS Deterministic RNG Completion Note

- Completed: 2026-03-27
- Scope: `backend` v3 optimizer only

## Implemented

1. Added deterministic seed + RNG helpers in v3 solver path:
   - `hashRequestIdToSeed(requestId: string)`
   - `createSeededRng(seed: number)`
2. Wired seeded RNG from `shadowContext?.requestId` in `optimizeRouteV3(...)`.
3. Threaded RNG through:
   - `solveRouteWithIls(..., rng, shadowContext?)`
   - `perturbFlexibleSegment(..., rng)`
   - `perturbFlexibleBlockGlobally(..., rng)`
4. Replaced perturbation-path `Math.random()` calls with `rng()`.
5. Kept fixed-window safety guards and acceptance logic unchanged (`worsensFixedLateness`, fixed-lateness precedence).
6. Kept API response shape and `algorithmVersion` unchanged.
7. Kept shadow logging schema unchanged.

## Test Coverage Added/Updated

1. Reproducibility test:
   - same input + same `requestId` yields identical ordered visit IDs across repeated runs.
2. Safety regression test retained for fixed-slack protection under seeded perturbations.
3. Guard test that v3 ILS perturbations do not call `Math.random`.

## Verification

- Ran:
  - `cd backend && npm run test -- src/app/api/optimize-route/v3/optimizeRouteService.test.ts`
- Result:
  - `53 passed, 0 failed`

## Known Limitation

- ILS still uses wall-clock cutoff (`Date.now()` + `ILS_TIME_LIMIT_MS`), so deterministic seed does not guarantee identical runtime budgets across different machines/load.
