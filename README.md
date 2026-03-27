# CAREFLOW

CareFlow is a nurse-focused route planning app with a React frontend and Next.js backend.

## What it does

- Requires authenticated access for patient and route-planner workflows.
- Manages patient records and visit windows.
- Optimizes daily visits with time windows, travel distance/time, and visit duration; planning date defaults to tomorrow and is configurable per session.
- Supports manual stop reordering with recalculated ETA flow.
- Renders the planned route on a Leaflet map with stop markers and driving path.
- Persists the optimized route result in sessionStorage so tab switches don't lose the result.
- Provides an authenticated global workspace header with sticky positioning, app logo, and rotating nurse quotes.
- Keeps header quote selection stable across browser refresh during a signed-in session.
- Clears all session-scoped storage (optimization result, draft, header quote) on logout and login.
- Uses a consistent overflow action menu pattern for patient row actions.
- Includes legal pages (Terms, Privacy, License, Trademark) accessible from the footer.
- Mobile-optimized route planner with wizard-style step flow and safe-area-aware sticky footer.

## Tech stack

- `frontend/`: Vite + React + TypeScript + Tailwind
- `backend/`: Next.js (App Router) + TypeScript
- `shared/`: shared contracts and validators
- Database: Postgres via Drizzle migrations

## Core APIs

- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PATCH /api/auth/me`
  - `POST /api/auth/update-password`
- Patients:
  - `GET /api/patients`
  - `POST /api/patients`
  - `PATCH /api/patients/:id`
  - `DELETE /api/patients/:id`
- Route planning:
  - `POST /api/optimize-route/v3` (current production planner flow)
  - `POST /api/optimize-route/v2` (legacy compatibility / rollback path)
- Address suggestions:
  - `GET /api/address-autocomplete?query=...`

## Local run

Install dependencies once:

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

Backend:

```bash
cd backend
cp .env.local.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## API base URL configuration (frontend)

The frontend resolves API base URL in this order:

1. `VITE_API_BASE_URL`
2. `window.__NAVIGATE_EASY_API_BASE_URL__` (runtime override)
3. `http://localhost:3000`

Example runtime override:

```html
<script>
  window.__NAVIGATE_EASY_API_BASE_URL__ = "https://api.yourdomain.com";
</script>
```

## Planning request shape

`POST /api/optimize-route/v3` expects:

- `planningDate` (`YYYY-MM-DD`)
- `timezone` (IANA timezone, example `America/Toronto`)
- `start`: `{ address, googlePlaceId? }`
- `end`: `{ address, googlePlaceId? }`
- `visits[]`: `{ visitId, patientId, patientName, address, windowStart, windowEnd, windowType, serviceDurationMinutes, googlePlaceId?, priority? }`
- `optimizationObjective?: "distance" | "time"` — defaults to `"distance"`

Notes:

- `start.departureTime` is optional and typically omitted by frontend.
- Backend computes departure dynamically when omitted (earliest first-stop anchor with travel-time + buffer).
- `"distance"` prioritizes less driving with bounded idle-gap tradeoffs.
- `"time"` prioritizes finishing sooner (combined wait + travel), with safeguards so it does not lose to an earlier equally-safe alternative when one exists.

## Optimizer endpoint selection

Current production endpoint is `POST /api/optimize-route/v3`.

Frontend still supports rollback routing:

- `VITE_ENABLE_ILS_OPTIMIZER=true` -> `POST /api/optimize-route/v3` (recommended / prod)
- unset / `false` -> `POST /api/optimize-route/v2` (legacy fallback)

`v3` and `v2` keep the same request/response contract, so UI render paths remain compatible.
For production parity, set `VITE_ENABLE_ILS_OPTIMIZER=true` in deployed frontend environments.

## Route optimizer scheduling logic (v3 production)

`POST /api/optimize-route/v3` runs in two stages:

1. Greedy seeded construction (depth 2, beam width 8) with window-aware priority tiers.
2. Deterministic seeded ILS refinement (request-id-seeded perturbations) under fixed-window safety guards.

### Step 1 — Candidate pool selection

At each step, the algorithm selects from a prioritised pool:

```text
Any FIXED patients remaining?
├── YES
│   ├── Any FIXED already late?
│   │   └── Pool: late fixed patients only
│   └── None late
│       └── Pool: near-due fixed patients only
│           - time mode: fixed with wait <= 30 min
│           - distance mode: fixed with wait <= 45 min
│       (if none are near-due, fall through to flexible tiers)
└── NO
    ├── Any windowed FLEXIBLE already late?
    │   └── Pool: late flexible patients only
    ├── Any windowed FLEXIBLE within 90 min of deadline?
    │   └── Pool: urgent flexible patients, sorted tightest deadline first (EDF)
    ├── Any remaining windowed FLEXIBLE?
    │   └── Pool: all remaining windowed flexible patients
    └── Otherwise
        └── Pool: all remaining patients (including no-window flexible)
```

### Step 2 — Seed scoring (depth-2 lookahead)

Within the pool, each candidate is scored across 5 dimensions (lower = better):

| Priority | Dimension | What it measures |
| --- | --- | --- |
| 1 | `fixedLateCount` | Number of fixed patients that end up late |
| 2 | `fixedLateSeconds` | Total lateness for fixed patients |
| 3 | `totalLateSeconds` | Total lateness for all patients |
| 4 | `totalWaitSeconds` | Idle wait time at stops |
| 5 | `totalTravelSeconds` | Total drive time (distance proxy) |

Priorities 4–5 are objective-dependent: `"distance"` (default) minimises wait then travel separately; `"time"` minimises their sum.

The beam search evaluates 2 steps ahead across the top 8 candidates, so lateness from future steps folds back into the current decision.

### Step 3 — Gap filler / sequence fill

If the selected anchor has a large idle gap before service start, the optimizer tries to fill that gap with feasible nearby visits (single filler or planned filler sequence), while preserving anchor feasibility.

### Step 4 — Deterministic ILS refinement

After the greedy seed is built, v3 runs deterministic ILS local search:

- perturbations are reproducible per `requestId` seed;
- accepted moves must not worsen fixed-window safety;
- objective-specific ranking is applied only after fixed-window/lateness safety precedence.

### Key properties

- Fixed-window safety is strict: accepted moves cannot worsen fixed late-count, fixed late-seconds, or fixed slack consumption.
- Distance mode prioritizes lower travel, with bounded idle-gap tradeoffs to reduce extreme idle blocks.
- Time mode prioritizes lower elapsed time (`wait + travel`) with bounded idle smoothing; if a less-driving candidate finishes earlier and is equally safe, time mode adopts it.
- Flexible patients within 90 min of deadline are elevated to urgent EDF ordering to prevent avoidable lateness.

## Additional docs

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [Deployment notes](DEPLOYMENT.md)
