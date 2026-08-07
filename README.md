# Routefy

Routefy is a route planning app for care workers, with a React frontend and Next.js backend.

## What it does

- Requires authenticated access for client and route-planner workflows.
- Manages client records, visit windows, and recurring visit templates.
- Generates concrete dated visit instances from recurring templates using the client's saved visit windows and duration.
- Prevents duplicate client visit windows (same start/end pair) at API and DB layers.
- Optimizes daily visits with time windows, travel distance/time, and visit duration; planning date defaults to tomorrow and is configurable per session.
- Auto-seeds the Route Planner with all scheduled visit instances across every recurring template that matches the planning date's day of week, with manual override support.
- "Plan my day" dashboard button: clears any stale draft, navigates to the Route Planner with today's date pre-selected, auto-seeds clients from today's recurring templates, and triggers optimization automatically once instances and home address are ready — no manual steps required.
- Route result confidence banner: shows a green "Schedule looks good" summary (visit count and estimated finish time) when all stops are on time; automatically suppressed if there are any warnings or unscheduled visits.
- Supports manual stop reordering with recalculated ETA flow.
- Renders the planned route on a Leaflet map with stop markers and driving path.
- Keeps optimized route results in memory only for the current tab lifecycle.
- Restores the last optimized route result from in-memory runtime cache when navigating away and back within the same tab/session state.
- Provides an authenticated global workspace header with sticky positioning and app logo.
- Keeps header quote selection stable across browser refresh during a signed-in session.
- Uses HttpOnly cookie-based sessions (no frontend token storage).
- Enforces PHI-safe client behavior: no PHI in browser persistence, URL params, logs, or telemetry.
- Requires all flows (including first-login onboarding) to remain PHI-safe: no PHI in browser storage, URL params, telemetry, or logs.
- Requires a first-use legal/privacy acknowledgement (`I Agree`) per signed-in user, stored server-side and re-prompted when policy version changes.
- Guides first-time users through `/welcome-setup` to save required profile, working-hours, and route-objective defaults.
- Treats home address as optional during setup; incomplete optional profile data is surfaced via dashboard nudge cards instead of blocking app usage.
- Adds break-reminder helper info (`i` icon) in both the onboarding setup flow and account settings working-hours form.
- Persists only non-sensitive route-planner draft fields in browser storage (IDs, ordering, inclusion flags, date/objective/UI step — no addresses or place IDs).
- Clears session-scoped browser storage (draft, header quote) on auth changes.
- Uses a consistent overflow action menu pattern for client row actions.
- Includes legal pages (Terms, Privacy, License, Trademark) accessible from the footer.
- Shows in-app policy reminders via info icons on Clients and Route Planner pages.
- Dashboard KPIs include routes today, active clients, deleted clients (last 30 days), template coverage, visits this week (last 7 days), on-time rate (last 7 days), drive hours (last 7 days), and total distance (last 7 days).
- Clicking the Drive Hours or Total Distance KPI cards on desktop triggers a fun car animation that flies randomly across the screen.
- Mobile-optimized route planner with wizard-style step flow and safe-area-aware sticky footer.
- Uses in-memory geocoding and travel-matrix caching (with in-flight request deduplication) to reduce repeated optimization latency.
- Internal **Admin Dashboard** at `/admin` (isolated login/session, no self-signup) for the data controller to monitor nurse signups/activity and manage accounts (deactivate/reactivate, reset password). Every admin action and PHI view is audited. See [Admin Dashboard design](docs/completed/admin-dashboard-plan.md), and the backend guide for account creation.

## Tech stack

- `frontend/`: Vite + React + TypeScript + Tailwind
- `backend/`: Next.js (App Router) + TypeScript
- `shared/`: shared contracts and validators
- Database: Postgres via Drizzle migrations

Recent schema changes:
- Migration `0015_true_chat.sql` removes legacy duplicate rows in `patient_visit_windows` and adds a unique index on `(patient_id, start_time, end_time)`.
- Migration `0017_recurring_template_days.sql` adds `recurring_visit_template_days` and backfills from old windows.
- Migration `0017_previous_tombstone.sql` drops `recurring_visit_template_windows` and `service_duration_minutes` from `recurring_visit_templates`.

## Core APIs

- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `PATCH /api/auth/me`
  - `POST /api/auth/update-password`
  - `GET /api/auth/legal-notice`
  - `POST /api/auth/legal-notice`
- Patients:
  - `GET /api/patients`
  - `POST /api/patients`
  - `PATCH /api/patients/:id`
  - `DELETE /api/patients/:id`
- Recurring visit templates:
  - `GET /api/recurring-visit-templates`
  - `POST /api/recurring-visit-templates`
  - `PATCH /api/recurring-visit-templates/:id`
  - `DELETE /api/recurring-visit-templates/:id`
- Visit instances:
  - `POST /api/visit-instances/expand`
  - `GET /api/visit-instances?planningDate=YYYY-MM-DD`
  - `PATCH /api/visit-instances/:id`
- Route planning:
  - `POST /api/optimize-route/v3` (route optimizer)
  - `POST /api/route-planner/advisor` (AI Route Advisor — PHI-free brief + suggestions; requires `ANTHROPIC_API_KEY`, else `503` and the UI hides the panel)
- Address suggestions:
  - `GET /api/address-autocomplete?query=...`
- Admin (isolated `routefy_admin_session`; behind `requireAdmin`):
  - `POST /api/admin/auth/login` · `POST /api/admin/auth/logout` · `GET /api/admin/auth/me`
  - `GET /api/admin/nurses` · `GET /api/admin/nurses/:id` · `GET /api/admin/nurses/:id/route-runs`
  - `GET /api/admin/metrics`
  - `POST /api/admin/nurses/:id/deactivate` · `.../reactivate` · `.../reset-password`

Notes:

- UI terminology uses **Client/Clients** for care recipients.
- API paths and shared contract field names remain `/api/patients`, `patientId`, and `patientName` for compatibility.
- Auth responses (`signup`, `login`, `me`) return setup progress fields on `user`:
  - `isSetupComplete: boolean`
  - `setupMissing: ("displayName" | "workingHours" | "optimizationObjective")[]`
- Setup completeness is based on `displayName`, at least one enabled `workingHours` day, and `optimizationObjective`; `homeAddress` is optional.

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
3. `http://localhost:3000` on local hosts; same-origin (`""`) on non-local hosts

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
- `nurseWorkingHours?`: `{ workStart, workEnd, lunchStartTime?, lunchDurationMinutes? }` — send this so the day doesn't start before `workStart` (see departure notes)
- `optimizationObjective?: "distance" | "time"` — defaults to `"distance"`

Notes:

- `start.departureTime` is optional and typically omitted by the frontend.
- When omitted, the backend computes departure dynamically: the earliest a fixed window requires leaving, otherwise `nurseWorkingHours.workStart`.
- When supplied, it's honored but **clamped up to `workStart`** if it would start the day earlier than a fixed window requires — so no visit is serviced before the shift unless a fixed window demands it. This clamp needs `nurseWorkingHours`; if it's omitted, the backend can't enforce it. (Details: backend README → "Departure time / day start".)
- `"distance"` prioritizes less driving with bounded idle-gap tradeoffs.
- `"time"` prioritizes finishing sooner (combined wait + travel), with safeguards so it does not lose to an earlier equally-safe alternative when one exists.

## Planning response shape

All times in the response (`start.departureTime`, each stop's `arrivalTime` /
`departureTime`, each task's `serviceStartTime` / `serviceEndTime`, …) are
**UTC instants** (ISO-8601, `…Z`). The response also echoes:

- `timezone` (the IANA zone the schedule was planned in, example `America/Toronto`)

**Clients MUST format every time in `response.timezone`, not the device's
zone.** Because the times carry no offset, formatting them in the device zone
(e.g. `Intl.DateTimeFormat` without an explicit `timeZone`, or
`Date.getHours()`) shows the wrong wall-clock whenever the device is in a
different zone than the route — the entire timeline shifts by the offset. The
same rule applies to any logic that compares times against working-hours /
lunch `HH:mm` values. `timezone` is optional for backward compatibility; when
absent, fall back to the device zone (legacy behavior).

## Optimizer endpoint

The route optimizer endpoint is `POST /api/optimize-route/v3` (ILS-seeded). The
legacy `v2` engine and the `VITE_ENABLE_ILS_OPTIMIZER` rollback flag have been
removed; the frontend always calls `v3`.

## Additional docs

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [Deployment notes](DEPLOYMENT.md)
- [Admin Dashboard — design & operations](docs/completed/admin-dashboard-plan.md)
