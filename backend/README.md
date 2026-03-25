# Backend

This folder contains the Next.js backend for CareFlow.

## Responsibilities

- Expose `POST /api/optimize-route/v2` for the current route optimization flow.
- Expose `POST /api/optimize-route/v3` as the feature-flagged seeded ILS engine path.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Expose auth endpoints for signup, login, current-user identity, and password updates.
- Geocode addresses through Google Places API.
- Fetch address suggestions through Google Places autocomplete.
- Enforce JWT authentication on all business endpoints, plus validation, timeouts, CORS, and lightweight rate limiting.

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
  - Optional comma-separated CORS allowlist.
  - Example: `http://localhost:5173`
- `DATABASE_URL`
  - Required for patient persistence.
  - Neon/Postgres connection string.
- `JWT_SECRET`
  - Required.
  - Secret used for signing and verifying access tokens.
- `JWT_EXPIRES_IN`
  - Optional.
  - JWT access-token TTL accepted by `jose` (for example `1h`, `30m`).
  - Default: `1h`.
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
  - Optional.
  - Upstash Redis REST URL used for centralized auth login/signup rate limiting across instances.
  - When omitted, auth rate limiting falls back to in-memory process-local buckets.
- `AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN`
  - Optional.
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
- `OPTIMIZE_ROUTE_V3_SHADOW_COMPARE`
  - Optional.
  - When `true`, `POST /api/optimize-route/v3` logs seed-vs-ILS diagnostics to the server console for rollout comparison.
  - Does not change the response payload.
- `OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE`
  - Optional.
  - Decimal between `0` and `1` used to sample `POST /api/optimize-route/v3` shadow comparison logs.
  - Default: `1`.
  - Example: `0.1` logs roughly 10% of requests with deterministic sampling by request ID.

Example local file:

```bash
DATABASE_URL=postgres://username:password@host:5432/database
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1h
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=5
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=60000
AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS=30
# Optional centralized auth limiter:
# AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>
# AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
# Optional local/proxy transport hardening override:
# AUTH_ENFORCE_HTTPS=true
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NOMINATIM_CONTACT_EMAIL=you@example.com
ALLOWED_ORIGINS=http://localhost:5173
OPTIMIZE_ROUTE_API_KEY=your_optional_optimize_route_key
OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS=30
OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS=60000
OPTIMIZE_ROUTE_V3_SHADOW_COMPARE=false
OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE=0.1
```

## API endpoints

### Auth

- `POST /api/auth/signup`
  - Accepts `{ displayName, email, password }`
  - Creates a nurse account and returns `{ token, user }`
  - Rejects duplicate emails with `409`
  - Enforces shared auth rate limiting by client IP and normalized account email
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `POST /api/auth/login`
  - Accepts `{ email, password }`
  - Returns `{ token, user }` when credentials are valid
  - Enforces auth rate limiting by client IP and normalized account email
  - Uses optional centralized Upstash Redis limiter when configured, otherwise in-memory fallback
  - Returns `429` with `Retry-After` header while lockout is active
  - Enforces HTTPS in production (or when `AUTH_ENFORCE_HTTPS=true`)
- `GET /api/auth/me`
  - Requires `Authorization: Bearer <token>`
  - Returns current authenticated user including `homeAddress`
- `PATCH /api/auth/me`
  - Requires `Authorization: Bearer <token>`
  - Accepts `{ homeAddress }` to update the nurse's saved home address
  - Returns updated profile
- `POST /api/auth/update-password`
  - Requires `Authorization: Bearer <token>`
  - Accepts `{ currentPassword, newPassword }`
  - Verifies current password before updating
  - Rejects no-op changes and weak passwords
  - Rate limited; returns `429` when exceeded

Authentication behavior:

- Missing/invalid/malformed bearer token returns `401`.
- Missing `JWT_SECRET` returns `500` configuration error.
- Auth endpoints include baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) and emit HSTS on HTTPS requests.

### Patients

- `GET /api/patients?query=...`
  - Requires `Authorization: Bearer <token>`
  - Lists patients for the authenticated nurse (`JWT sub`)
  - Optional `query` applies case-insensitive substring search on first/last name
- `POST /api/patients`
  - Requires `Authorization: Bearer <token>`
  - Creates a patient for the authenticated nurse (`JWT sub`)
  - Returns `201` with created patient JSON
- `PATCH /api/patients/:id`
  - Requires `Authorization: Bearer <token>`
  - Partially updates a patient owned by the authenticated nurse (`JWT sub`)
  - If `address` changes and `googlePlaceId` is omitted, clears `googlePlaceId` to prevent stale mismatches
  - Returns updated patient JSON
- `DELETE /api/patients/:id`
  - Requires `Authorization: Bearer <token>`
  - Hard deletes a patient owned by the authenticated nurse (`JWT sub`)
  - Returns `{ "deleted": true, "id": "..." }`

### Route planning

- `POST /api/optimize-route/v2`
  - Requires `Authorization: Bearer <token>`
  - See request/response shape below
  - Enforces per-client in-memory rate limiting
- `POST /api/optimize-route/v3`
  - Requires `Authorization: Bearer <token>`
  - Same request/response contract as `v2` during the rollout phase
  - Reserved for the feature-flagged ILS engine path
  - Enforces the same API-key and per-client rate-limit rules as `v2`

### Address autocomplete

- `GET /api/address-autocomplete?query=...`
  - Requires `Authorization: Bearer <token>`
  - Returns up to 5 suggestions
  - Uses Google Places autocomplete with short in-memory caching and per-client rate limiting

## Route optimizer — v2 scheduling logic

`POST /api/optimize-route/v2` uses a greedy beam search (depth 2, beam width 8) with priority tiers and EDF candidate selection.

### Step 1 — Candidate pool selection

At each step, the algorithm selects from a prioritised pool:

```text
Any FIXED patients remaining?
├── YES
│   ├── Any FIXED already late?  → Pool: late fixed patients only
│   └── None late               → Pool: all fixed patients
└── NO
    ├── Any FLEXIBLE (windowed) already late?   → Pool: late flexible patients only
    ├── Any FLEXIBLE within 90 min of deadline? → Pool: urgent flexible patients, sorted tightest deadline first (EDF)
    └── None urgent                             → Pool: all remaining patients
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

### Step 3 — Gap filler

After a candidate is selected, if it has > 30 min of idle wait before its window opens, the algorithm checks whether a nearby no-window or flexible patient can be inserted into that gap without delaying the anchor visit.

### Key properties

- The `optimizationObjective` field (`"distance"` or `"time"`, default `"distance"`) only affects priority 4–5 tiebreaking — it never overrides deadline pressure.
- Distance is the **last** tiebreaker — it never overrides deadline pressure.
- The gap filler can only **insert**, never displace a selected candidate.
- Flexible patients within 90 min of their deadline are elevated to a priority pool and sorted by tightest deadline first (EDF), so they are picked before going late rather than after.

### Warnings in response

The optimizer returns an optional `warnings[]` array:

| Type | Meaning |
| --- | --- |
| `window_conflict` | Two fixed patients whose windows cannot both be satisfied given travel time between them |
| `fixed_late` | Fixed patient will be served more than 15 min past their window close |
| `flexible_late` | Flexible patient will be served more than 60 min past their window close |

## Key files

- `src/app/api/optimize-route/v2/optimizeRouteService.ts` — core scheduling algorithm
- `src/app/api/optimize-route/v2/travelMatrix.ts` — Google Routes travel duration matrix
- `src/app/api/optimize-route/v2/validation.ts` — request validation
- `src/app/api/optimize-route/v2/types.ts` — internal types
- `src/app/api/address-autocomplete/route.ts`
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/lib/patients/`
- `src/db/schema.ts`
- `drizzle/`
