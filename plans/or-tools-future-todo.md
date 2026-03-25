# OR-Tools Future TODO (Deferred)

## Goal
Track the work required to evaluate and potentially adopt an OR-Tools-based VRP solver in the future.

## Why Deferred
- Current stack is TypeScript + serverless, where OR-Tools integration cost is high.
- Near-term plan is ILS in pure TypeScript.
- Revisit OR-Tools only if ILS quality/runtime is insufficient.

## Entry Criteria (when to revisit)
- ILS shadow metrics plateau and still miss quality targets.
- Route size/complexity grows (more stops, tighter windows, more constraints).
- Team can support infra changes (service split or native runtime).

## Decision Gate A: Integration Path
1. Choose one:
   - Native OR-Tools service (recommended): separate backend worker/service.
   - WASM in existing runtime (higher risk, only if required).
2. Document deployment impact, cold-start profile, and operational ownership.

## Modeling TODO
1. Map existing request fields into OR-Tools model:
   - start/end depot
   - service durations
   - fixed/flexible windows
   - working hours
   - lunch/break behavior
2. Define hard vs soft constraints and penalty magnitudes.
3. Define objective modes:
   - distance-first
   - time-first

## Implementation TODO
1. Add a feature flag: `optimizationEngine = greedy | ils | ortools`.
2. Implement `solveWithOrTools(...)` with output matching current response contract.
3. Keep warnings/unscheduled behavior compatible with existing API.
4. Add deterministic timeout and fallback behavior.

## Validation TODO
1. Parity tests:
   - no regressions in fixed-window feasibility.
   - warnings and unscheduled reasons remain consistent.
2. Benchmark suite:
   - runtime p50/p95
   - quality delta vs ILS and greedy
3. Shadow mode logging in production before any cutover.

## Decision Gate B: Cutover Readiness
- Promote OR-Tools only if all are true:
  - quality improves materially on target scenarios
  - runtime stays within SLA
  - operational complexity is acceptable
  - fallback path is proven

## Non-goals (for now)
- No immediate replacement of ILS.
- No unresolved WASM toolchain experiments in production path.
