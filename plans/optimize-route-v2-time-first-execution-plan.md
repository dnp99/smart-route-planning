# Optimize Route V2 Time-First Execution Plan

Date: 2026-03-13

## Objective

Add a new endpoint, `POST /api/optimize-route/v2`, that optimizes routes with this priority order:

1. Time-window feasibility (especially fixed windows)
2. Time-window quality (lateness, excessive waiting, soft-window drift)
3. Distance and travel time

Keep `POST /api/optimize-route` (v1) unchanged and fully supported.

## Why V2 Exists

Current route optimization is effectively distance-first and does not model visit windows.
The patient model currently has one preferred window per patient, and the optimize-route request does not carry any scheduling fields.
This blocks:

- one patient with multiple fixed windows (for example morning and evening)
- true time-aware sequencing
- robust handling of same-address tasks with different windows

V2 solves this without breaking current clients.

## Scope

### In scope

- new `v2` endpoint with time-aware optimization
- visit-level route inputs (not only patient-level)
- support multiple visit windows per patient
- support multiple patients at the same address
- deterministic scoring and tie-break rules
- full test coverage for window-first behavior

### Out of scope

- removing or changing v1 behavior
- mandatory replacement of existing patient CRUD in the same phase
- advanced external solver integration in phase 1 (optional future upgrade)

## V2 Endpoint Contract

Path:

- `POST /api/optimize-route/v2`

Headers:

- `Authorization: Bearer <token>` (same as v1)
- `Content-Type: application/json`
- optional `x-optimize-route-key` (same environment behavior as v1)

### Request type

```ts
type VisitWindowType = "fixed" | "flexible";

type OptimizeRouteV2Visit = {
  visitId: string;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  windowStart: string; // HH:MM local time
  windowEnd: string; // HH:MM local time
  windowType: VisitWindowType;
  serviceDurationMinutes: number; // integer > 0
  priority?: number; // optional future tie-break input
};

type OptimizeRouteV2Request = {
  planningDate: string; // YYYY-MM-DD
  timezone: string; // IANA, e.g. America/Toronto
  start: {
    address: string;
    googlePlaceId?: string | null;
    departureTime: string; // ISO timestamp
  };
  end: {
    address: string;
    googlePlaceId?: string | null;
  };
  visits: OptimizeRouteV2Visit[];
};
```

### Response type

```ts
type OptimizeRouteV2TaskResult = {
  visitId: string;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: "fixed" | "flexible";
  serviceDurationMinutes: number;
  arrivalTime: string; // ISO
  serviceStartTime: string; // ISO
  serviceEndTime: string; // ISO
  waitSeconds: number;
  lateBySeconds: number;
  onTime: boolean;
};

type OptimizeRouteV2OrderedStop = {
  stopId: string; // deterministic key per location-cluster instance
  address: string;
  coords: { lat: number; lon: number };
  arrivalTime: string; // ISO
  departureTime: string; // ISO
  tasks: OptimizeRouteV2TaskResult[];
  distanceFromPreviousKm: number;
  durationFromPreviousSeconds: number;
  isEndingPoint?: boolean;
};

type OptimizeRouteV2UnscheduledTask = {
  visitId: string;
  patientId: string;
  reason:
    | "fixed_window_unreachable"
    | "invalid_window"
    | "duration_exceeds_window"
    | "insufficient_day_capacity";
};

type OptimizeRouteV2Response = {
  start: {
    address: string;
    coords: { lat: number; lon: number };
    departureTime: string;
  };
  end: {
    address: string;
    coords: { lat: number; lon: number };
  };
  orderedStops: OptimizeRouteV2OrderedStop[];
  routeLegs: Array<{
    fromStopId: string;
    toStopId: string;
    fromAddress: string;
    toAddress: string;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
  }>;
  unscheduledTasks: OptimizeRouteV2UnscheduledTask[];
  metrics: {
    fixedWindowViolations: number;
    totalLateSeconds: number;
    totalWaitSeconds: number;
    totalDistanceMeters: number;
    totalDistanceKm: number;
    totalDurationSeconds: number;
  };
  algorithmVersion: string; // e.g. "v2.1.0-greedy-window-first"
};
```

### Example request

```json
{
  "planningDate": "2026-03-13",
  "timezone": "America/Toronto",
  "start": {
    "address": "3361 Ingram Road, Mississauga, ON",
    "departureTime": "2026-03-13T07:30:00-04:00"
  },
  "end": {
    "address": "3361 Ingram Road, Mississauga, ON"
  },
  "visits": [
    {
      "visitId": "visit-yasmin-am",
      "patientId": "patient-yasmin",
      "patientName": "Yasmin Ramji",
      "address": "6931 Forest Park Drive, Mississauga, ON",
      "windowStart": "08:30",
      "windowEnd": "09:00",
      "windowType": "fixed",
      "serviceDurationMinutes": 20
    },
    {
      "visitId": "visit-yasmin-pm",
      "patientId": "patient-yasmin",
      "patientName": "Yasmin Ramji",
      "address": "6931 Forest Park Drive, Mississauga, ON",
      "windowStart": "19:30",
      "windowEnd": "20:00",
      "windowType": "fixed",
      "serviceDurationMinutes": 20
    },
    {
      "visitId": "visit-hassan-pm",
      "patientId": "patient-hassan",
      "patientName": "Hassan Ramji",
      "address": "6931 Forest Park Drive, Mississauga, ON",
      "windowStart": "19:30",
      "windowEnd": "20:15",
      "windowType": "fixed",
      "serviceDurationMinutes": 20
    }
  ]
}
```

## Validation Rules (V2)

- `visits` required, max count same operational limit as v1 unless explicitly increased.
- `visitId` unique within request.
- `windowStart/windowEnd` must be valid `HH:MM`.
- cross-midnight windows rejected in phase 1.
- `serviceDurationMinutes` must be integer, `>= 1`.
- fixed window must be able to contain service duration (`end - start >= serviceDurationMinutes`).
- start departure time must be valid ISO and align to `planningDate/timezone`.

## Optimization Semantics

V2 objective is lexicographic, not weighted-sum-only.

Primary objective group:

1. minimize number of fixed-window violations
2. minimize sum of fixed-window lateness seconds

Secondary objective group:

1. minimize flexible-window lateness/drift seconds
2. minimize total waiting seconds

Tertiary objective group:

1. minimize total travel duration seconds
2. minimize total travel distance meters

Tie-break:

- deterministic by `visitId` ascending after score equality

## Same-Address Handling

V2 must not collapse visits that share an address.

Rules:

- each visit remains a distinct task by `visitId`
- geocoding/travel lookup may be deduped by location key:
  - `googlePlaceId` when present
  - else normalized address key
- if consecutive tasks are at identical coordinates, travel leg is zero
- stop model supports multiple tasks at the same location in sequence

## Multi-Window Patient Handling

A patient with two fixed windows is represented as two visits.

Example:

- patient `patient-yasmin`
- visits: `visit-yasmin-am`, `visit-yasmin-pm`

Both can share address and patient identity while keeping independent schedule constraints.

## Algorithm Approach (Phase 1)

Phase-1 engine should be explicit and testable:

1. normalize + validate visits
2. geocode unique location keys
3. build travel-time matrix for unique locations
4. construct schedule greedily with backtracking for fixed-window feasibility:
   - prioritize earliest hard-window deadlines first
   - insert flexible tasks in slack intervals
   - when conflicts exist, choose plan with better lexicographic score
5. materialize route legs and stop/task timestamps

Future algorithm upgrades can replace internals while preserving contract and scoring semantics.

## Compatibility and Versioning

- keep existing `POST /api/optimize-route` unchanged (v1 contract and behavior)
- introduce independent request/response parser for v2
- frontend can opt in per feature flag or per page switch
- v1 remains fallback until v2 stabilizes

## Backend Implementation Plan

### Phase A: Contracts and Validation

- add shared contract types for v2 request/response
- add request guards and parser for v2 payload
- add validation tests for all rule branches

### Phase B: Time-Aware Optimization Service

- add `optimizeRouteV2Service.ts`
- implement location dedupe + geocoding map
- implement window-first scheduler and scoring
- build leg enrichment using existing driving route integrations

### Phase C: Route Handler

- add `backend/src/app/api/optimize-route/v2/route.ts`
- wire auth, API key guard, rate-limit guard, error mapping, CORS
- return v2 response contract with parser guard

### Phase D: Frontend Integration (Optional First Rollout)

- create v2 client service function
- add non-breaking UI toggle (v1/v2 strategy)
- keep v1 default until acceptance criteria pass

## Testing Plan

### Unit tests

- validation:
  - invalid windows
  - duplicate `visitId`
  - service duration > window
- scheduling:
  - fixed windows respected before flexible tasks
  - same-address different-patient tasks preserved
  - same-patient morning/evening windows preserved
- routing:
  - zero-distance legs for identical coordinates
  - metrics aggregation consistency

### Integration tests

- `POST /api/optimize-route/v2` happy path with mixed fixed/flexible
- impossible fixed-window task appears in `unscheduledTasks`
- v1 endpoint regression tests remain green

## Rollout Plan

1. Deploy backend v2 dark (no frontend usage yet).
2. Run side-by-side comparison with production-like payloads.
3. Enable frontend v2 for internal users only.
4. Promote v2 to default once schedule-quality KPIs pass.
5. Keep v1 available as explicit fallback for a deprecation window.

## Acceptance Criteria

- v1 behavior unchanged.
- v2 always prefers fewer fixed-window violations over shorter distance.
- v2 supports multiple visits for one patient in one day.
- v2 supports multiple patients at same address without identity loss.
- v2 responses include enough timing detail to explain ordering decisions.

## Risks and Mitigations

- Risk: greedy scheduler misses global optimum.
  - Mitigation: deterministic scoring + backtracking depth cap + future solver upgrade path.
- Risk: increased compute cost for matrix + scheduling.
  - Mitigation: max visit limits, geocode/matrix dedupe, cached lookups.
- Risk: timezone/date edge-case bugs.
  - Mitigation: strict timezone-required request field, exhaustive boundary tests.

## Locked Decisions

1. Visit-window persistence is required in v2 rollout.

- add `patient_visit_windows` as a first-class persisted entity
- keep existing patient single-window fields temporarily for compatibility
- backfill one default window row per existing patient during migration
- frontend route planner should source selectable visits from persisted windows, not ad-hoc request-only entries

2. Flexible-window penalties are non-zero outside the preferred window.

- fixed windows remain hard-priority constraints
- flexible windows use soft penalties:
  - `0` when service start is inside `[windowStart, windowEnd]`
  - linear penalty outside the window: seconds to nearest window boundary
- this preserves schedule realism while still allowing flexible-task placement when needed

3. Phase-1 v2 scale limits are locked as:

- max `40` visits per request
- max `25` unique geocoded locations per request
- if limits are exceeded, return `400` with explicit validation error

4. Per-task ETA visibility is required before v2 becomes default.

- v2 response already includes task timing fields; frontend must surface them
- internal rollout may start before UI parity is complete
- production default switch from v1 to v2 is blocked until per-task ETA/compliance is visible in route results UI
