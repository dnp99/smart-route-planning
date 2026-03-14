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

## Additional docs

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [Deployment notes](DEPLOYMENT.md)
- [Implementation log](plans/change-log.md)
