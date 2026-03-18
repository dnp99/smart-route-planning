# Optimize Route V2 Gap-Closure Execution Plan

Date: 2026-03-14
Last updated: 2026-03-17

## Objective

This plan is completed. It is retained as the execution record for the `v2.3.0-matrix-lookahead-unscheduled` rollout of `POST /api/optimize-route/v2`.

## Current Status Snapshot

### Completed since this plan was created

- Frontend overlap warnings are visible in both mobile and desktop review flows and remain non-blocking.
- Flexible visits with no preferred window are now accepted and auto-scheduled.
- Flexible visits now enforce partial-window validation (both start/end or neither).
- Fixed-window duration validation now returns patient-specific actionable messaging.

### Gap-closure outcomes (v2.3.0)

1. Ordering/scoring uses planning-time travel matrix durations when available, with fallback to estimated travel on matrix failure.
2. Candidate evaluation uses bounded multi-step lookahead with deterministic tie-break behavior.
3. `unscheduledTasks` is actively produced using explicit policy (`insufficient_day_capacity` for flexible visits that cannot fit in-day).
4. Validation rejects flexible preferred windows that are shorter than `serviceDurationMinutes` when both window bounds are provided.

## Scope

### In scope

- backend scheduler improvements for travel-time realism and deeper risk lookahead
- backend request validation adjustment for duration vs window consistency
- explicit v2 unscheduled-task production policy
- targeted tests and contract-safe rollout

### Out of scope

- changing v1 (`/api/optimize-route`) behavior
- replacing heuristic scheduler with an external optimization solver in this phase
- auth/rate-limit/endpoint contract redesign

## Target Outcome

Achieved outcomes:

- chosen stop order uses travel-time estimates that better match final Google routing legs
- scheduler avoids myopic choices that create avoidable downstream fixed-window lateness
- `unscheduledTasks` behavior is deterministic and tested
- duration-window validation is internally consistent and documented for all visit types

## Execution Phases

## Phase 1: Travel-Time Alignment

Status: Completed

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

Status: Completed

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

Status: Completed

### Goal

Make unscheduled and validation behavior explicit and predictable.

### Tasks

1. Finalize and document scheduling policy:
   - fixed visits stay scheduled even if late
   - flexible visits may be unscheduled only for explicit reasons (if a capacity policy is introduced)
2. Implement `unscheduledTasks` production logic according to policy.
3. Finalize duration/window policy for flexible visits with provided windows:
   - reject windows shorter than `serviceDurationMinutes`, or
   - normalize with explicit warning policy (choose one and document).
4. Update shared-contract expectations and tests for the chosen policy.

### Deliverables

- scheduler emits non-empty `unscheduledTasks` when policy conditions occur
- validation and tests aligned to a documented, single rule set

### Acceptance criteria

- no ambiguous cases where a visit is neither scheduled nor unscheduled
- validation errors are deterministic and actionable

## Phase 4: Frontend Warning UX (Non-Blocking)

Status: Completed

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

## Completed Items (Already Shipped)

- Overlap warnings shown in both mobile and desktop review.
- Overlap warnings remain advisory and do not block optimize.
- No-preferred-window autoscheduling for flexible visits.
- Flexible partial-window validation (both-or-none).

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

- planner tests for warning-only overlap UX (already covered)

## Rollout Strategy

1. Rolled out behind algorithm version bump `v2.3.0-matrix-lookahead-unscheduled`.
2. Continue comparative telemetry as needed:
   - selected order
   - projected vs actual leg duration deltas
   - fixed-window violation counts
3. Keep this plan as the reference record for the v2.3.0 rollout.

## Risks and Mitigations

1. Higher API latency/cost from matrix calls.
   - Mitigation: per-request dedupe, fallback mode, and bounded matrix usage.
2. Combinatorial runtime from deeper lookahead.
   - Mitigation: bounded depth/beam width and early-pruning heuristics.
3. Behavioral drift from previous route order.
   - Mitigation: algorithm versioning and scenario regression suite.

## Implementation Checklist

- [x] Phase 1 completed with tests and lint
- [x] Phase 2 completed with tests and lint
- [x] Phase 3 completed with tests and lint
- [x] Phase 4 completed with tests and lint
- [x] No-preferred-window autoscheduling completed and verified
- [x] change-log entry added for final v2.3 rollout
