# Optimize Route V2 Gap-Closure Execution Plan

Date: 2026-03-14

## Objective

Close the remaining quality gaps in `POST /api/optimize-route/v2` so stop ordering is more consistent with real drive time, fixed-window risk is evaluated beyond one hop, unscheduled semantics are explicit, and the frontend gives non-blocking conflict visibility.

## Context

Current v2 behavior already supports overlapping windows and keeps fixed visits in-route when late. The remaining gaps are:

1. Ordering uses estimated travel (`haversine + constant speed`) while final metrics use Google leg durations.
2. Downstream risk scoring is only one-step lookahead.
3. `unscheduledTasks` is not actively produced by scheduler logic.
4. Flexible windows can be shorter than service duration, creating guaranteed lateness cases.
5. Frontend no longer blocks overlaps (correct), but also no longer shows overlap warnings.

## Scope

### In scope

- backend scheduler improvements for travel-time realism and deeper risk lookahead
- backend request validation adjustment for duration vs window consistency
- explicit v2 unscheduled-task production policy
- frontend warning UX for overlaps without blocking optimize
- targeted tests and contract-safe rollout

### Out of scope

- changing v1 (`/api/optimize-route`) behavior
- replacing heuristic scheduler with an external optimization solver in this phase
- auth/rate-limit/endpoint contract redesign

## Target Outcome

After this plan:

- chosen stop order uses travel-time estimates that better match final Google routing legs
- scheduler avoids myopic choices that create avoidable downstream fixed-window lateness
- `unscheduledTasks` behavior is deterministic and tested
- duration-window validation is internally consistent for all visit types
- UI surfaces overlap conflicts as warnings while still allowing optimize

## Execution Phases

## Phase 1: Travel-Time Alignment

### Goal

Use a shared travel-time model for both ordering and scoring.

### Tasks

1. Add a v2 planning-time travel matrix utility for start + all visit locations.
2. Prefer Google-derived matrix durations for candidate scoring.
3. Keep a fallback path to current estimate model if matrix acquisition fails.
4. Preserve deterministic ordering when durations tie.

### Deliverables

- new planning-time travel matrix helper under `backend/src/app/api/optimize-route/v2/`
- scheduler updated to consume matrix durations instead of only haversine-speed estimates
- tests covering matrix success and fallback mode

### Acceptance criteria

- ranking decisions use the same duration source family as final route legs when matrix is available
- fallback path does not break existing request flow

## Phase 2: Multi-Step Risk Lookahead

### Goal

Reduce avoidable downstream lateness caused by one-step scoring.

### Tasks

1. Extend candidate evaluation from one-step to bounded multi-step lookahead (depth 2 or beam-width heuristic).
2. Score futures lexicographically:
   - fixed-late count
   - fixed-late seconds
   - total late seconds
   - wait
   - travel duration
3. Keep runtime bounded for max visit limits.

### Deliverables

- updated selector with bounded future simulation
- performance guardrails for worst-case visit counts
- deterministic tie-break rules documented in code comments/tests

### Acceptance criteria

- scenario tests show fewer avoidable fixed-window misses than current one-step logic
- runtime remains acceptable at current request limits

## Phase 3: Unscheduled Semantics + Validation Consistency

### Goal

Make unscheduled and validation behavior explicit and predictable.

### Tasks

1. Define scheduling policy:
   - fixed visits stay scheduled even if late (already desired behavior)
   - flexible visits may be unscheduled only for explicit reasons (if day-capacity policy triggers)
2. Implement `unscheduledTasks` production logic according to policy.
3. Tighten duration/window validation for flexible windows:
   - reject windows shorter than `serviceDurationMinutes` for all visit types, or
   - normalize with explicit warning policy (choose one and document).
4. Update shared-contract expectations and tests for chosen policy.

### Deliverables

- scheduler emits non-empty `unscheduledTasks` when policy conditions occur
- validation and tests aligned to documented rule set

### Acceptance criteria

- no ambiguous cases where a visit is neither scheduled nor unscheduled
- validation errors are deterministic and actionable

## Phase 4: Frontend Warning UX (Non-Blocking)

### Goal

Restore user visibility of overlap conflicts without preventing optimization.

### Tasks

1. Reintroduce overlap detection in planner as advisory only.
2. Show row-level warning style and summary warning copy.
3. Keep Optimize button enabled when other required fields are valid.
4. Ensure warning text is consistent with backend acceptance of overlaps.

### Deliverables

- updated `RoutePlanner` warning-only overlap UX
- frontend tests asserting warning presence and non-blocking submit

### Acceptance criteria

- users see overlap risk before optimize
- overlap warnings do not disable submission

## Testing Strategy

### Backend

- `optimizeRouteService` scenarios for:
  - matrix vs fallback ordering
  - two-step/beam lookahead improvement cases
  - unscheduled reason emission
  - fixed-late-but-scheduled guarantees
- `validation` tests for duration-window rules across fixed/flexible
- `route` handler tests for unchanged API response shape

### Frontend

- planner tests for warning-only overlap UX
- integration tests for overlapping windows submission path

## Rollout Strategy

1. Introduce behind algorithm version bump (`v2.3.x`) with clear response tagging.
2. Deploy with log-only telemetry first for comparative analysis:
   - selected order
   - projected vs actual leg duration deltas
   - fixed-window violation counts
3. Promote tuned algorithm as default after telemetry confirms no regression.

## Risks and Mitigations

1. Higher API latency/cost from matrix calls.
   - Mitigation: per-request dedupe, fallback mode, and bounded matrix usage.
2. Combinatorial runtime from deeper lookahead.
   - Mitigation: bounded depth/beam width and early-pruning heuristics.
3. Behavioral drift from previous route order.
   - Mitigation: algorithm versioning and scenario regression suite.

## Implementation Checklist

- [ ] Phase 1 completed with tests and lint
- [ ] Phase 2 completed with tests and lint
- [ ] Phase 3 completed with tests and lint
- [ ] Phase 4 completed with tests and lint
- [ ] change-log entry added for final rollout
