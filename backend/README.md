# Backend

This folder contains the Next.js backend for Navigate Easy.

## Responsibilities

- Expose `POST /api/optimize-route` for route optimization.
- Expose `GET /api/address-autocomplete` for address suggestions.
- Geocode addresses through OpenStreetMap Nominatim.
- Enforce request validation, timeouts, CORS, and lightweight rate limiting.

## Local development

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

The backend runs on `http://localhost:3000`.

`npm run dev` uses webpack mode by default for local reliability.

## Environment variables

- `ALLOWED_ORIGINS`
  - Optional comma-separated CORS allowlist.
  - Example: `http://localhost:5173`
- `GOOGLE_MAPS_API_KEY`
  - Required for driving route distance, duration, and route geometry.
- `NOMINATIM_CONTACT_EMAIL`
  - Recommended for production or shared environments to identify requests to the upstream geocoding provider.

Example local file:

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ALLOWED_ORIGINS=http://localhost:5173
NOMINATIM_CONTACT_EMAIL=you@example.com
```

## API endpoints

- `POST /api/optimize-route`
  - Accepts `startAddress`, `endAddress`, and `addresses[]`
  - Returns geocoded stops in greedy nearest-neighbor order plus Google driving route legs, total distance, and total duration
- `GET /api/address-autocomplete?query=...`
  - Returns up to 5 suggestions
  - Uses short in-memory caching and per-client rate limiting

## Key files

- `src/app/api/optimize-route/route.ts`
- `src/app/api/address-autocomplete/route.ts`
