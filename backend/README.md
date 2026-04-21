# Backend

This folder contains the Next.js backend for Routefy.

## Responsibilities

- Expose `POST /api/optimize-route/v3` for the current production route optimization flow.
- Keep `POST /api/optimize-route/v2` available as a legacy compatibility / rollback path.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Expose auth endpoints for signup, login, logout, current-user identity, and password updates.
- Geocode addresses through Google Places API.
- Fetch address suggestions through Google Places autocomplete.
- Enforce authenticated access on business endpoints (cookie sessions), plus validation, timeouts, CORS, and lightweight rate limiting.
- Reduce optimize-route latency with in-memory geocode and travel-matrix caching plus in-flight request deduplication.

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
  - Optional shared secret for `POST /api/optimize-route/v2` and `POST /api/optimize-route/v3`.
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
```

## API endpoints

### Auth

- `POST /api/auth/signup`
  - Accepts `{ displayName, email, password }`
  - Creates a nurse account and returns `{ user }`
  - Sets `careflow_session` HttpOnly cookie
  - Rejects duplicate emails with `409`
  - Enforces shared auth rate limiting by client IP and normalized account email
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `POST /api/auth/login`
  - Accepts `{ email, password }`
  - Returns `{ user }` when credentials are valid
  - Sets `careflow_session` HttpOnly cookie
  - Enforces auth rate limiting by client IP and normalized account email
  - Uses optional centralized Upstash Redis limiter when configured, otherwise in-memory fallback
  - Returns `429` with `Retry-After` header while lockout is active
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `POST /api/auth/logout`
  - Revokes current session and clears `careflow_session` cookie
- `GET /api/auth/me`
  - Requires valid auth session cookie (`careflow_session`)
  - Returns current authenticated user including `homeAddress`
- `PATCH /api/auth/me`
  - Requires valid auth session cookie (`careflow_session`)
  - Accepts `{ homeAddress }` to update the nurse's saved home address
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
  - Current production optimizer endpoint
  - Same request/response contract as `v2`
  - Enforces per-client in-memory rate limiting and optional API-key protection
- `POST /api/optimize-route/v2`
  - Requires authenticated session
  - Legacy compatibility / rollback endpoint
  - Enforces the same API-key and per-client rate-limit rules as `v3`

### Address autocomplete

- `GET /api/address-autocomplete?query=...`
  - Requires authenticated session
  - Returns up to 5 suggestions
  - Uses Google Places autocomplete with short in-memory caching and per-client rate limiting

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
- Route optimization history is minimized: identifying task fields (`patient_name`, `address`) are no longer written.
- Existing identifying optimization-task fields are redacted by migration `0010_awesome_hairball.sql`.
- Migration `0011_spicy_ben_parker.sql` adds legal acknowledgement fields to `nurses`.
- Migration `0012_cold_serpent_society.sql` adds `auth_sessions.device_type`.
- Migration `0014_curvy_eternals.sql` adds cleanup indexes on `auth_sessions.expires_at` and `auth_sessions.revoked_at`.
- Migration `0015_true_chat.sql` de-duplicates existing `patient_visit_windows` rows and enforces unique windows per patient via `(patient_id, start_time, end_time)`.

## Optimization performance caches

Routefy uses process-local in-memory caches for expensive routing dependencies:

- Geocoding cache (`src/app/api/optimize-route/geocoding.ts`)
  - TTL: 24 hours
  - Max entries: 5000
  - Keys: normalized address and (when available) Google Place ID
  - Includes in-flight dedupe so concurrent requests for the same target share one upstream call
- Travel matrix cache (`src/app/api/optimize-route/v2/travelMatrix.ts`)
  - TTL: 10 minutes
  - Max entries: 500
  - Key: normalized set of nodes (location key + rounded coordinates)
  - Includes in-flight dedupe so concurrent requests for the same matrix share one Google Routes call

Notes:

- Caches are intentionally ephemeral and local to each backend process.
- Upstream fetches still use `cache: "no-store"`; application-level caches control reuse behavior.

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

### Warnings in response

The optimizer returns an optional `warnings[]` array:

| Type | Meaning |
| --- | --- |
| `window_conflict` | Two fixed patients whose windows cannot both be satisfied given travel time between them |
| `fixed_late` | Fixed patient will be served more than 15 min past their window close |
| `flexible_late` | Flexible patient will be served more than 60 min past their window close |

## Key files

- `src/app/api/optimize-route/v3/optimizeRouteService.ts` — production scheduling algorithm (greedy seed + seeded ILS)
- `src/app/api/optimize-route/v3/route.ts` — v3 endpoint wiring
- `src/app/api/optimize-route/v2/optimizeRouteService.ts` — legacy scheduling algorithm
- `src/app/api/optimize-route/v2/travelMatrix.ts` — Google Routes travel duration matrix
- `src/app/api/optimize-route/v2/validation.ts` — request validation
- `src/app/api/optimize-route/v2/types.ts` — internal types
- `src/app/api/address-autocomplete/route.ts`
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/lib/patients/`
- `src/db/schema.ts`
- `drizzle/`
