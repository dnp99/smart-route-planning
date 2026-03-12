# Backend

This folder contains the Next.js backend for Navigate Easy.

## Responsibilities

- Expose `POST /api/optimize-route` for route optimization.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Geocode addresses through OpenStreetMap Nominatim.
- Fetch address suggestions through Google Places API.
- Enforce request validation, timeouts, CORS, and lightweight rate limiting.

## Local development

```bash
npm ci
cp .env.local.example .env.local
npm run db:migrate
npm run dev
```

The backend runs on `http://localhost:3000`.

`npm run dev` uses webpack mode by default for local reliability.

`npm run db:migrate` runs Drizzle SQL migrations and seeds the default phase-1 nurse row (`external_key=default-nurse`) idempotently.

## Environment variables

- `ALLOWED_ORIGINS`
  - Optional comma-separated CORS allowlist.
  - Example: `http://localhost:5173`
- `DATABASE_URL`
  - Required for patient persistence.
  - Neon/Postgres connection string.
- `DEFAULT_NURSE_POC`
  - Required for patient endpoints.
  - Must be `true` to enable patient CRUD in phase 1.
- `DEFAULT_NURSE_ID`
  - Required when `DEFAULT_NURSE_POC=true`.
  - Must match `nurses.external_key` (for example `default-nurse`).
- `GOOGLE_MAPS_API_KEY`
  - Required for Google driving route distance, duration, route geometry, and address suggestions.
- `OPTIMIZE_ROUTE_API_KEY`
  - Optional.
  - If set, `POST /api/optimize-route` requires this value in the `x-optimize-route-key` header.
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

Example local file:

```bash
DATABASE_URL=postgres://username:password@host:5432/database
DEFAULT_NURSE_POC=true
DEFAULT_NURSE_ID=default-nurse
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ALLOWED_ORIGINS=http://localhost:5173
OPTIMIZE_ROUTE_API_KEY=your_optional_optimize_route_key
OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS=30
OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS=60000
NOMINATIM_CONTACT_EMAIL=you@example.com
```

## API endpoints

- `POST /api/optimize-route`
  - Accepts `startAddress`, `endAddress`, and either:
    - legacy `addresses[]` (string destinations), or
    - `destinations[]` objects with `address` and optional patient metadata (`patientId`, `patientName`, `googlePlaceId`)
  - Returns geocoded stops in greedy nearest-neighbor order plus Google driving route legs, total distance, and total duration
  - Enforces per-client in-memory rate limiting
  - If `OPTIMIZE_ROUTE_API_KEY` is configured, requires `x-optimize-route-key` request header
- `GET /api/address-autocomplete?query=...`
  - Returns up to 5 suggestions
  - Uses Google Places autocomplete with short in-memory caching and per-client rate limiting
- `GET /api/patients?query=...`
  - Lists patients for the resolved default nurse
  - Optional `query` applies case-insensitive substring search on first/last name
- `POST /api/patients`
  - Creates a patient for the resolved default nurse
  - Returns `201` with created patient JSON
- `PATCH /api/patients/:id`
  - Partially updates a patient owned by the resolved default nurse
  - Returns updated patient JSON
- `DELETE /api/patients/:id`
  - Hard deletes a patient owned by the resolved default nurse
  - Returns `{ "deleted": true, "id": "..." }`

Patient endpoint configuration behavior:

- Missing `DATABASE_URL` returns `500` config error.
- `DEFAULT_NURSE_POC !== true` returns `500` unsupported error.
- `DEFAULT_NURSE_POC=true` without `DEFAULT_NURSE_ID` returns `500` config error.

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
