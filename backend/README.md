# Backend

This folder contains the Next.js backend for CareFlow.

## Responsibilities

- Expose `POST /api/optimize-route/v3` for route optimization.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Expose auth endpoints for signup, login, logout, current-user identity, and password updates.
- Manage client (patient) records and visit windows.
- Manage recurring visit templates (name, date range, active flag, weekdays via `recurring_visit_template_days`).
- Expand recurring templates into concrete dated visit instances using the client's saved visit windows and duration.
- Geocode addresses through Google Places API.
- Fetch address suggestions through Google Places autocomplete.
- Enforce authenticated access on business endpoints (cookie sessions), plus validation, timeouts, CORS, and lightweight rate limiting.
- Reduce optimize-route latency with in-memory geocode and travel-matrix caching plus in-flight request deduplication.
- Serve the internal **Admin API** (`/api/admin/*`): isolated admin auth/session, read dashboard (nurse list, per-nurse detail + route-run history, in-app metrics), and audited account actions (deactivate/reactivate, reset password). All admin actions and PHI views are written to `audit_events` with `actor_admin_id`.

## Local development

```bash
npm ci
cp .env.local.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

The backend runs on `http://localhost:3000`.

`npm run dev` uses webpack mode by default for local reliability.

`npm run db:generate` creates Drizzle-managed SQL migrations and metadata in `backend/drizzle`.

`npm run db:migrate` applies committed Drizzle migrations.

Production/runtime behavior:

- `npm run build` performs compile-only (`next build`) and does not require database credentials.
- `npm run start` automatically runs `npm run db:migrate` before starting the server.
- `npm run start:nomigrate` starts the server without applying migrations (escape hatch).

## Environment variables

- `ALLOWED_ORIGINS`
  - Required comma-separated CORS allowlist.
  - Example: `http://localhost:5173`
- `DATABASE_URL`
  - Required for patient persistence.
  - Neon/Postgres connection string.
- `AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS`
  - Optional.
  - Max auth login/signup attempts per client/account bucket within the auth rate-limit window.
  - Default: `5`.
- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
  - Optional.
  - Login rate-limit window in milliseconds.
  - Default: `60000`.
- `AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS`
  - Optional.
  - Lockout duration in seconds after exceeding auth login/signup limits.
  - Default: `30`.
- `AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL`
  - Required in production.
  - Upstash Redis REST URL used for centralized auth login/signup rate limiting across instances.
  - In non-production, when omitted, auth rate limiting falls back to in-memory process-local buckets.
- `AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN`
  - Required in production.
  - Upstash Redis REST token for centralized auth login/signup rate limiting.
- `AUTH_ENFORCE_HTTPS`
  - Optional.
  - When `true`, rejects non-HTTPS requests for auth endpoints with `426`.
  - Production (`NODE_ENV=production`) enforces HTTPS automatically.
- `GOOGLE_MAPS_API_KEY`
  - Required for Google driving route distance, duration, route geometry, and address suggestions.
- `NOMINATIM_CONTACT_EMAIL`
  - Optional but recommended contact email used in fallback Nominatim geocoding requests.
  - Example: `you@example.com`.
- `OPTIMIZE_ROUTE_API_KEY`
  - Optional shared secret for `POST /api/optimize-route/v3`.
  - When set, requests must include header `x-optimize-route-key`.
- `OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS`
  - Optional.
  - Max optimize-route requests per client within the rate-limit window.
  - Default: `30`.
- `OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS`
  - Optional.
  - Optimize-route rate-limit window in milliseconds.
  - Default: `60000`.
- `SESSION_CLEANUP_CRON_SECRET`
  - Required in production when running scheduled session cleanup.
  - Secret used by `GET/POST /api/internal/session-cleanup` via `Authorization: Bearer <secret>` (or `x-session-cleanup-key`).
  - On Vercel you can instead set `CRON_SECRET` (the route accepts it too); Vercel Cron auto-sends it as `Authorization: Bearer <CRON_SECRET>`, so the scheduled job in `vercel.json` authenticates without extra config.
- `SESSION_CLEANUP_REVOKED_RETENTION_DAYS`
  - Optional.
  - Number of days to keep revoked sessions before cleanup deletes them.
  - Default: `30`.
- `OPTIMIZE_ROUTE_V3_SHADOW_COMPARE`
  - Optional.
  - When `true`, `POST /api/optimize-route/v3` logs seed-vs-ILS diagnostics to the server console.
  - Does not change the response payload.
- `OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE`
  - Optional.
  - Decimal between `0` and `1` used to sample `POST /api/optimize-route/v3` shadow comparison logs.
  - Default: `1`.
  - Example: `0.1` logs roughly 10% of requests with deterministic sampling by request ID.
- `ANTHROPIC_API_KEY`
  - Optional. Enables the Route Advisor (`POST /api/route-planner/advisor`), which turns an optimized route into a plain-English brief + suggestions via Claude Haiku.
  - Read server-side only — never shipped to the frontend. The browser sends a de-identified, PHI-free context (no patient names/addresses).
  - When absent, the endpoint returns `503` and the frontend hides the advisor panel (no error surfaced).

Example local file:

```bash
DATABASE_URL=postgres://username:password@host:5432/database
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=5
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=60000
AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS=30
# Required in production for centralized auth limiter:
AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>
AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
# Optional local/proxy transport hardening override:
# AUTH_ENFORCE_HTTPS=true
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NOMINATIM_CONTACT_EMAIL=you@example.com
ALLOWED_ORIGINS=http://localhost:5173
OPTIMIZE_ROUTE_API_KEY=your_optional_optimize_route_key
OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS=30
OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS=60000
SESSION_CLEANUP_CRON_SECRET=replace_with_a_long_random_secret
SESSION_CLEANUP_REVOKED_RETENTION_DAYS=30
OPTIMIZE_ROUTE_V3_SHADOW_COMPARE=false
OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE=0.1
# Optional — enables the AI Route Advisor; omit to disable the feature:
ANTHROPIC_API_KEY=sk-ant-...
```

## API endpoints

### Auth

- `POST /api/auth/signup`
  - Accepts `{ displayName, email, password }`
  - Creates a nurse account and returns `{ user }` with setup-progress fields:
    - `isSetupComplete: boolean`
    - `setupMissing: ("displayName" | "workingHours" | "optimizationObjective")[]`
  - Sets `careflow_session` HttpOnly cookie
  - Rejects duplicate emails with `409`
  - Enforces shared auth rate limiting by client IP and normalized account email
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `POST /api/auth/login`
  - Accepts `{ email, password }`
  - Returns `{ user }` when credentials are valid, including:
    - `isSetupComplete: boolean`
    - `setupMissing: ("displayName" | "workingHours" | "optimizationObjective")[]`
  - Sets `careflow_session` HttpOnly cookie
  - Enforces auth rate limiting by client IP and normalized account email
  - Uses optional centralized Upstash Redis limiter when configured, otherwise in-memory fallback
  - Returns `429` with `Retry-After` header while lockout is active
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `POST /api/auth/logout`
  - Revokes current session and clears `careflow_session` cookie
- `GET /api/auth/me`
  - Requires valid auth session cookie (`careflow_session`)
  - Returns current authenticated user including `homeAddress` and setup-progress fields (`isSetupComplete`, `setupMissing`)
- `PATCH /api/auth/me`
  - Requires valid auth session cookie (`careflow_session`)
  - Accepts one or more profile/setup fields:
    - `{ displayName }`
    - `{ homeAddress }`
    - `{ workingHours, breakGapThresholdMinutes }`
    - `{ optimizationObjective }`
  - Returns updated profile
- `POST /api/auth/update-password`
  - Requires valid auth session cookie (`careflow_session`)
  - Accepts `{ currentPassword, newPassword }`
  - Verifies current password before updating
  - Rejects no-op changes and weak passwords
  - Rate limited; returns `429` when exceeded
- `GET /api/auth/legal-notice`
  - Requires valid auth session cookie (`careflow_session`)
  - Returns current acknowledgement status for the active legal notice version
- `POST /api/auth/legal-notice`
  - Requires valid auth session cookie (`careflow_session`)
  - Accepts `{ agree: true }`
  - Stores acknowledgement timestamp + version for the authenticated nurse

Authentication behavior:

- Missing/invalid/revoked/expired session returns `401`.
- `careflow_session` cookie attributes: `HttpOnly`, `Path=/`, 1-day max-age, `Secure` in production, `SameSite=Lax` in local dev and `SameSite=None` in production.
- Auth endpoints include baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) and emit HSTS on HTTPS requests.
- Setup completeness is derived from `displayName`, `workingHours` (at least one enabled day), and `optimizationObjective`; `homeAddress` is optional and not part of required setup completion.

### Patients

- `GET /api/patients?query=...`
  - Requires authenticated session
  - Lists active patients for the authenticated nurse
  - Optional `query` applies case-insensitive substring search on first/last name
- `POST /api/patients`
  - Requires authenticated session
  - Creates a patient for the authenticated nurse
  - Rejects duplicate visit windows in payload (same `startTime` + `endTime`)
  - Returns `201` with created patient JSON
- `PATCH /api/patients/:id`
  - Requires authenticated session
  - Partially updates a patient owned by the authenticated nurse
  - Rejects duplicate visit windows in payload (same `startTime` + `endTime`)
  - If `address` changes and `googlePlaceId` is omitted, clears `googlePlaceId` to prevent stale mismatches
  - Returns updated patient JSON
- `DELETE /api/patients/:id`
  - Requires authenticated session
  - Archive-only behavior: marks patient inactive (`isActive=false`) instead of hard deletion
  - Returns `{ "deleted": true, "id": "..." }`

### Route planning

- `POST /api/optimize-route/v3`
  - Requires authenticated session
  - Route optimizer endpoint (greedy seed + seeded ILS)
  - Enforces per-client in-memory rate limiting and optional API-key protection
- `POST /api/route-planner/advisor`
  - Requires authenticated session
  - AI Route Advisor: accepts a de-identified, PHI-free route context and returns `{ brief, suggestions[] }` from Claude Haiku (translates the solver's output — never re-plans)
  - Per-nurse in-memory rate limit (`429`); `503` when `ANTHROPIC_API_KEY` is unset; `502` on an upstream AI failure
  - Audits aggregates only (stop/warning counts) — never the advice text or any patient data

### Recurring visit templates

- `GET /api/recurring-visit-templates`
  - Requires authenticated session
  - Returns all recurring visit templates for the authenticated nurse, each including `daysOfWeek`
- `POST /api/recurring-visit-templates`
  - Requires authenticated session
  - Accepts `{ patientId, name?, timezone, recurrenceRule, startDate, endDate?, isActive?, daysOfWeek }`
  - `daysOfWeek` is an array of integers 0 (Sun) – 6 (Sat); at least one required
  - Returns `201` with created template JSON
- `PATCH /api/recurring-visit-templates/:id`
  - Requires authenticated session
  - Partially updates a template owned by the authenticated nurse
  - Accepts any subset of `{ name, timezone, recurrenceRule, startDate, endDate, isActive, daysOfWeek }`
  - Replaces `daysOfWeek` atomically when provided
  - Returns updated template JSON
- `DELETE /api/recurring-visit-templates/:id`
  - Requires authenticated session
  - Deletes the template and all visit instances derived from it (transaction)
  - Returns `{ "deleted": true, "id": "..." }`

### Visit instances

- `POST /api/visit-instances/expand`
  - Requires authenticated session
  - Accepts `{ planningDate?, startDate?, endDate?, templateIds? }`
  - Expands active recurring templates into concrete dated visit instances using each client's saved visit windows and duration
  - Idempotent: repeated expansion never creates duplicates (keyed by `<templateId>:<patientVisitWindowId>:<planningDate>`)
  - Returns `{ created: number, skipped: number }`
- `GET /api/visit-instances?planningDate=YYYY-MM-DD`
  - Requires authenticated session
  - Returns all visit instances for the authenticated nurse on the given planning date
- `PATCH /api/visit-instances/:id`
  - Requires authenticated session
  - Partially updates a visit instance owned by the authenticated nurse
  - Accepts any subset of `{ status, planningDate, address, googlePlaceId, windowStart, windowEnd, visitTimeType, serviceDurationMinutes }`
  - Sets `isManualOverride = true` on address/window/duration changes
  - Returns updated visit instance JSON

### Address autocomplete

- `GET /api/address-autocomplete?query=...`
  - Requires authenticated session
  - Returns up to 5 suggestions
  - Uses Google Places autocomplete with short in-memory caching and per-client rate limiting

### Admin

Isolated from nurse auth: a separate `routefy_admin_session` HttpOnly cookie, its
own `admins` / `admin_sessions` tables, and a `requireAdmin` guard that rejects
nurse sessions outright. There is **no admin self-signup** (see _Creating an
admin_ below). Every action and PHI view is audited with `actor_admin_id`.

- `POST /api/admin/auth/login` — `{ email, password }` → sets `routefy_admin_session`; generic `401` on unknown/inactive/wrong-password; audits `admin.login` (success/denied).
- `POST /api/admin/auth/logout` — revokes the admin session and clears the cookie.
- `GET /api/admin/auth/me` — current admin, or `401` (clears a stale cookie).
- `GET /api/admin/nurses` — nurse list with signup, last login, last activity, active-client count, status.
- `GET /api/admin/nurses/:id` — profile + full client list (**PHI**) + recent activity feed; audits `admin.nurse.view`.
- `GET /api/admin/nurses/:id/route-runs[?before=<ISO>]` — paginated route-run history, aggregate stats only (no request/result payloads → no PHI). First page = last 7 days; then cursor pages of 30 via `nextCursor`/`hasMore`.
- `GET /api/admin/metrics` — nurse totals, signups (+14-day trend), DAU/WAU, clients added, route runs, template coverage, onboarding risk.
- `POST /api/admin/nurses/:id/deactivate` / `/reactivate` — flips `nurses.is_active` (a deactivated nurse is rejected at login); audited.
- `POST /api/admin/nurses/:id/reset-password` — generates a one-time temp password (returned once, never stored/logged), sets `nurses.must_change_password`; the nurse is forced to change it at next login; audited.

#### Creating an admin

Admins are created out-of-band with the seed script (bcrypt cost 12, 10-char
minimum, duplicate-email safe):

```bash
# local/dev (reads DATABASE_URL from .env.local):
npm run admin:create you@email.com "Your Name"     # prompts for password (hidden)

# production (override DATABASE_URL with the prod value; ADMIN_PASSWORD optional):
DATABASE_URL='postgres://…PROD…' node scripts/create-admin.mjs you@email.com "Your Name"
```

Prod alternative (Neon SQL editor) — the app's bcryptjs verifies pgcrypto `$2a$`
hashes at cost 12:

```sql
create extension if not exists pgcrypto;
insert into admins (email, display_name, password_hash)
values (lower(trim('you@email.com')), 'Your Name',
        crypt('YOUR_STRONG_PASSWORD', gen_salt('bf', 12)));
```

Then sign in at `/admin`. Full design + operational notes:
[`docs/completed/admin-dashboard-plan.md`](../docs/completed/admin-dashboard-plan.md).

### Internal maintenance

- `GET /api/internal/session-cleanup` / `POST /api/internal/session-cleanup`
  - Requires `SESSION_CLEANUP_CRON_SECRET` via `Authorization: Bearer <secret>` (or `x-session-cleanup-key`).
  - Deletes expired sessions and stale revoked sessions.
  - Intended for scheduled invocations (for example Vercel Cron).
  - Current cron schedule (`backend/vercel.json`): `0 2 * * *` (daily at 02:00 UTC).
  - Note: Vercel Hobby supports daily cron frequency only.

## Security and Privacy Hardening (Current)

- Auth uses server-managed sessions in `auth_sessions`.
- Session records also store derived `device_type` (`desktop`, `mobile`, `tablet`, `bot`, `unknown`) inferred from the request `user_agent`.
- Scheduled session cleanup removes expired rows and revoked rows older than configured retention.
- Legal acknowledgement is tracked per nurse via `nurses.legal_notice_accepted_at` and `nurses.legal_notice_accepted_version`.
- Audit events are persisted in `audit_events` for patient read/write, optimize-route access, and dashboard access.
- Admin auth is fully isolated from nurse auth (separate `admins`/`admin_sessions`, `routefy_admin_session` cookie, `requireAdmin`); every admin action and PHI view is audited with `actor_admin_id`, and `admins.password_hash` uses the same bcrypt (cost 12) as nurses.
- Migration `0020_dapper_sugar_man.sql` adds `admins`, `admin_sessions`, `audit_events.actor_admin_id`, and `nurses.must_change_password`.
- Route optimization history is minimized: identifying task fields (`patient_name`, `address`) are no longer written.
- Existing identifying optimization-task fields are redacted by migration `0010_awesome_hairball.sql`.
- Migration `0011_spicy_ben_parker.sql` adds legal acknowledgement fields to `nurses`.
- Migration `0012_cold_serpent_society.sql` adds `auth_sessions.device_type`.
- Migration `0014_curvy_eternals.sql` adds cleanup indexes on `auth_sessions.expires_at` and `auth_sessions.revoked_at`.
- Migration `0015_true_chat.sql` de-duplicates existing `patient_visit_windows` rows and enforces unique windows per patient via `(patient_id, start_time, end_time)`.
- Migration `0017_recurring_template_days.sql` adds `recurring_visit_template_days` and backfills from old windows; `recurring_visit_template_windows` and `service_duration_minutes` subsequently dropped.

## Optimization performance caches

Routefy uses process-local in-memory caches for expensive routing dependencies:

- Geocoding cache (`src/app/api/optimize-route/geocoding.ts`)
  - TTL: 24 hours
  - Max entries: 5000
  - Keys: normalized address and (when available) Google Place ID
  - Includes in-flight dedupe so concurrent requests for the same target share one upstream call
- Travel matrix cache (`src/app/api/optimize-route/v3/travelMatrix.ts`)
  - TTL: 10 minutes
  - Max entries: 500
  - Key: normalized set of nodes (location key + rounded coordinates)
  - Includes in-flight dedupe so concurrent requests for the same matrix share one Google Routes call

Notes:

- Caches are intentionally ephemeral and local to each backend process.
- Upstream fetches still use `cache: "no-store"`; application-level caches control reuse behavior.

Notes on recurring templates:

- Visit timing and duration come from the client record, not the template. Templates own only recurrence schedule (`daysOfWeek`, dates, timezone, active flag).
- `recurring_visit_template_days` stores one row per weekday per template; unique on `(template_id, day_of_week)`.
- Expansion produces one visit instance per (template × patient visit window × planning date) combination.
- Clients with no visit windows fall back to `preferredVisitStartTime` / `preferredVisitEndTime` from the patient record.

## Route optimizer — v3 (production) scheduling logic

`POST /api/optimize-route/v3` uses a greedy beam-search seed (depth 2, beam width 8) with priority tiers and EDF candidate selection, then applies deterministic seeded ILS refinement with fixed-window safety guards.

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

### Step 2 — Score every candidate (depth-2 lookahead)

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

If a selected anchor has a large idle gap before service start, v3 attempts to fill that gap with feasible nearby visits (single filler or planned filler sequence) without breaking anchor feasibility.

### Key properties

- The `optimizationObjective` field (`"distance"` or `"time"`, default `"distance"`) controls the final objective tradeoff after fixed-window safety and lateness priorities are enforced.
- Distance is the **last** tiebreaker — it never overrides deadline pressure.
- Distance mode guardrail: if the distance solution is strictly worse than the time benchmark on fixed-window safety, v3 falls back to the time benchmark.
- Nearby clustering preference: visit pairs within `0.5 km` are scored to stay consecutive unless consecutive service would create a fixed-window conflict.
- Flexible patients within 90 min of their deadline are elevated to a priority pool and sorted by tightest deadline first (EDF), so they are picked before going late rather than after.

### Departure time / day start

- If the request omits `start.departureTime`, v3 computes it: the earliest a **fixed window** requires leaving to arrive on time, otherwise `nurseWorkingHours.workStart` (falling back to a default when no working hours are given).
- If the request **supplies** `start.departureTime`, it is honored — but when `nurseWorkingHours` is present it is **clamped up** to that same earliest-justified departure. A caller cannot start the workday before `workStart` unless a fixed window genuinely requires it; a gratuitously-early departure is pulled forward to `workStart`.
- `workStart`/`workEnd` remain soft (they never make a route infeasible). Early departure to reach a genuinely-early fixed appointment is preserved, and once the nurse is out, visits are serviced as reached — there is no "wait until `workStart`" idling. Net effect: no visit is serviced before the shift starts unless a fixed window demands it. **Callers must send `nurseWorkingHours` for this clamp to apply.**

### Warnings in response

The optimizer returns an optional `warnings[]` array:

| Type | Meaning |
| --- | --- |
| `window_conflict` | Two fixed patients whose windows cannot both be satisfied given travel time between them |
| `fixed_late` | Fixed patient will be served more than 15 min past their window close |
| `flexible_late` | Flexible patient will be served more than 60 min past their window close |

## Key files

- `src/app/api/optimize-route/v3/optimizeRouteService.ts` — scheduling algorithm (greedy seed + seeded ILS)
- `src/app/api/optimize-route/v3/route.ts` — endpoint wiring
- `src/app/api/optimize-route/v3/travelMatrix.ts` — Google Routes travel duration matrix
- `src/app/api/optimize-route/v3/validation.ts` — request validation
- `src/app/api/optimize-route/v3/types.ts` — internal types
- `src/app/api/address-autocomplete/route.ts`
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/app/api/recurring-visit-templates/route.ts`
- `src/app/api/recurring-visit-templates/[id]/route.ts`
- `src/app/api/visit-instances/expand/route.ts`
- `src/app/api/visit-instances/route.ts`
- `src/app/api/visit-instances/[id]/route.ts`
- `src/lib/patients/`
- `src/lib/recurrence/recurrenceRepository.ts` — template CRUD, expansion logic, occurrence key generation
- `src/lib/recurrence/recurrenceDto.ts` — template and visit instance DTO mappers
- `src/lib/recurrence/recurrenceValidation.ts` — request validators for templates and visit instances
- `src/app/api/admin/` — admin API routes (auth, nurses list/detail/route-runs, metrics, actions)
- `src/lib/admin/` — admin auth (session cookie/repo, `requireAdmin`), dashboard/nurse repositories, `logAdminAuditEvent`, temp-password generator
- `scripts/create-admin.mjs` — one-off admin bootstrap (`npm run admin:create`)
- `src/db/schema.ts`
- `drizzle/`
