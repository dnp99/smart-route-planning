# CAREFLOW

CareFlow is a nurse-focused route planning app with a React frontend and Next.js backend.

## What it does

- Requires authenticated access for patient and route-planner workflows.
- Manages patient records and visit windows.
- Optimizes daily visits with time windows, travel distance/time, and visit duration.
- Renders the planned route on a Leaflet map with stop markers and driving path.

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
- Patients:
  - `GET /api/patients`
  - `POST /api/patients`
  - `PATCH /api/patients/:id`
  - `DELETE /api/patients/:id`
- Route planning:
  - `POST /api/optimize-route/v2` (current planner flow)
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

## V2 planning request shape

`POST /api/optimize-route/v2` expects:

- `planningDate` (`YYYY-MM-DD`)
- `timezone` (IANA timezone, example `America/Toronto`)
- `start`: `{ address, googlePlaceId? }`
- `end`: `{ address, googlePlaceId? }`
- `visits[]`: `{ visitId, patientId, patientName, address, windowStart, windowEnd, windowType, serviceDurationMinutes, googlePlaceId?, priority? }`

Notes:

- `start.departureTime` is optional and typically omitted by frontend.
- Backend computes departure dynamically when omitted (earliest first-stop anchor with travel-time + buffer).

## Route optimizer scheduling logic

`POST /api/optimize-route/v2` uses a greedy beam search (depth 2, beam width 8) with priority tiers and EDF urgency scoring.

### Step 1 — Candidate pool selection

At each step, the algorithm selects from a prioritised pool:

```text
Any FIXED patients remaining?
├── YES
│   ├── Any FIXED already late?  → Pool: late fixed patients only
│   └── None late               → Pool: all fixed patients
└── NO
    ├── Any FLEXIBLE (windowed) already late? → Pool: late flexible patients only
    └── None late                             → Pool: all remaining patients
```

### Step 2 — Score every candidate (depth-2 lookahead)

Within the pool, each candidate is scored across 6 dimensions (lower = better):

| Priority | Dimension | What it measures |
| --- | --- | --- |
| 1 | `fixedLateCount` | Number of fixed patients that end up late |
| 2 | `fixedLateSeconds` | Total lateness for fixed patients |
| 3 | `totalLateSeconds` | Total lateness for all patients |
| 4 | `flexibleUrgencySeconds` | EDF pressure — flexible patients within 90 min of deadline accumulate urgency; deferring them raises this score |
| 5 | `totalWaitSeconds` | Idle wait time at stops |
| 6 | `totalTravelSeconds` | Total drive time (distance proxy) |

The beam search evaluates 2 steps ahead across the top 8 candidates, so urgency and lateness from future steps fold back into the current decision.

### Step 3 — Gap filler

After a candidate is selected, if it has > 30 min of idle wait before its window opens, the algorithm checks whether a nearby no-window or flexible patient can be inserted into that gap without delaying the anchor visit.

### Key properties

- Distance is the **last** tiebreaker — it never overrides deadline pressure.
- The gap filler can only **insert**, never displace a selected candidate.
- `flexibleUrgencySeconds` propagates forward through the lookahead, so tight-deadline patients are detected and elevated before they actually go late (Earliest Deadline First).

## Additional docs

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [Deployment notes](DEPLOYMENT.md)
- [Implementation log](plans/change-log.md)
