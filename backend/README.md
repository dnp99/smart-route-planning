# Backend

This folder contains the Next.js backend for CareFlow.

## Responsibilities

- Expose `POST /api/optimize-route` for route optimization.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Expose auth endpoints for signup, login, and current-user identity.
- Geocode addresses through OpenStreetMap Nominatim.
- Fetch address suggestions through Google Places API.
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

If you are upgrading an existing database that still contains the legacy POC nurse row, run the one-time bootstrap command before attempting login:

```bash
LEGACY_NURSE_EXTERNAL_KEY=default-nurse \
LEGACY_NURSE_EMAIL=nurse@example.com \
LEGACY_NURSE_PASSWORD=replace_with_a_strong_password \
npm run db:bootstrap-legacy-nurse
```

Set `LEGACY_NURSE_DISPLAY_NAME` as well if you want to rename the legacy nurse during bootstrap.

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
  - Max login attempts per client within the auth rate-limit window.
  - Default: `5`.
- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
  - Optional.
  - Login rate-limit window in milliseconds.
  - Default: `60000`.
- `GOOGLE_MAPS_API_KEY`
  - Required for Google driving route distance, duration, route geometry, and address suggestions.
- `OPTIMIZE_ROUTE_API_KEY`
  - Optional.
  - If set, `POST /api/optimize-route` requires this value in the `x-optimize-route-key` header.
  - For browser-based frontend usage, leave this unset unless you can securely inject/request it from a trusted backend proxy.
- `OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS`
  - Optional.
  - Max optimize-route requests per client within the rate-limit window.
  - Default: `30`.
- `OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS`
  - Optional.
  - Optimize-route rate-limit window in milliseconds.
  - Default: `60000`.
- `NOMINATIM_CONTACT_EMAIL`
  - Recommended for production or shared environments to identify requests to the upstream geocoding provider.
- `LEGACY_NURSE_EXTERNAL_KEY`
  - Optional one-time selector for `npm run db:bootstrap-legacy-nurse`.
  - Default: `default-nurse`.
- `LEGACY_NURSE_EMAIL`
  - Optional one-time bootstrap email used by `npm run db:bootstrap-legacy-nurse`.
- `LEGACY_NURSE_PASSWORD`
  - Optional one-time bootstrap password used by `npm run db:bootstrap-legacy-nurse`.
  - Must be at least 8 characters.
- `LEGACY_NURSE_DISPLAY_NAME`
  - Optional one-time display-name override applied during legacy nurse bootstrap.

Example local file:

```bash
DATABASE_URL=postgres://username:password@host:5432/database
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1h
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=5
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=60000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ALLOWED_ORIGINS=http://localhost:5173
OPTIMIZE_ROUTE_API_KEY=your_optional_optimize_route_key
OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS=30
OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS=60000
NOMINATIM_CONTACT_EMAIL=you@example.com
LEGACY_NURSE_EXTERNAL_KEY=default-nurse
LEGACY_NURSE_EMAIL=nurse@example.com
LEGACY_NURSE_PASSWORD=replace_with_a_strong_password
LEGACY_NURSE_DISPLAY_NAME=Default Nurse
```

## API endpoints

- `POST /api/auth/login`
  - Accepts `{ email, password }`
  - Returns `{ token, user }` when credentials are valid
  - Enforces per-client in-memory login rate limiting
- `POST /api/auth/signup`
  - Accepts `{ displayName, email, password }`
  - Creates a nurse account and returns `{ token, user }`
  - Rejects duplicate emails with `409`
  - Enforces per-client in-memory signup/login rate limiting
- `GET /api/auth/me`
  - Requires `Authorization: Bearer <token>`
  - Returns current authenticated user
- `POST /api/optimize-route`
  - Requires `Authorization: Bearer <token>`
  - Accepts `startAddress`, `endAddress`, and `destinations[]`
  - Each destination must include `patientId`, `patientName`, `address`, and optional `googlePlaceId`
  - Returns geocoded stops in greedy nearest-neighbor order plus Google driving route legs, total distance, and total duration
  - Enforces per-client in-memory rate limiting
  - If `OPTIMIZE_ROUTE_API_KEY` is configured, requires `x-optimize-route-key` request header
- `GET /api/address-autocomplete?query=...`
  - Requires `Authorization: Bearer <token>`
  - Returns up to 5 suggestions
  - Uses Google Places autocomplete with short in-memory caching and per-client rate limiting
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
  - Returns updated patient JSON
- `DELETE /api/patients/:id`
  - Requires `Authorization: Bearer <token>`
  - Hard deletes a patient owned by the authenticated nurse (`JWT sub`)
  - Returns `{ "deleted": true, "id": "..." }`

Authentication behavior:

- Missing/invalid/malformed bearer token returns `401`.
- Missing `JWT_SECRET` returns `500` configuration error.
- Authentication assumes nurse accounts already exist in the database; no default bootstrap nurse is created automatically.
- `npm run db:bootstrap-legacy-nurse` upgrades the legacy nurse row in place using `external_key`, preserving the original nurse `id` so existing patient ownership remains intact.
- Before applying the final auth-constraint migration, confirm `select id, external_key, email, password_hash from nurses where email is null or password_hash is null;` returns zero rows in every durable environment.
- Before applying the final auth-constraint migration in a durable environment, verify no `nurses` rows remain with null `email` or `password_hash`.

Patient update behavior note:

- When updating a patient address:
  - sending `googlePlaceId` explicitly sets that value (including explicit `null` to clear);
  - if `address` changes and `googlePlaceId` is omitted, backend clears `googlePlaceId` to avoid stale place-id/address mismatches.

## Key files

- `src/app/api/optimize-route/route.ts`
- `src/app/api/address-autocomplete/route.ts`
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/lib/patients/`
- `src/db/schema.ts`
- `drizzle/`
