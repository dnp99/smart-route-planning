# Google Routes Phase 1 Plan

## Objective

Upgrade the current route planner from straight-line distance estimation to real driving distance, duration, and route geometry while keeping the existing stop-ordering logic in place.

Phase 1 intentionally does **not** change the route optimization algorithm. The backend will still choose stop order using the current nearest-neighbor flow; the change is limited to replacing haversine leg metrics and straight polylines with Google Routes API results.

## Current State

- Geocoding uses OpenStreetMap Nominatim in `backend/src/app/api/optimize-route/route.ts`.
- Stop order uses greedy nearest-neighbor based on haversine distance.
- Frontend map draws straight lines between stop coordinates in `frontend/src/components/RouteMap.tsx`.
- API responses expose straight-line distance data, not actual driving route or ETA.

## Target Outcome

After this phase:

- Each trip leg returns driving distance in meters or kilometers derived from Google Routes.
- Each trip leg returns driving duration.
- Each trip leg returns route geometry suitable for rendering on the frontend map.
- Total trip distance and total trip duration are aggregated from Google route legs.
- Frontend route map renders the real driving path instead of straight line segments.
- Existing UI structure stays intact as much as possible.

## Scope

### In scope

- Add Google Routes API integration for driving route computation.
- Add backend env var support for `GOOGLE_MAPS_API_KEY`.
- Update optimize-route response shape to include driving route information.
- Update frontend result rendering to show drive time and route-based distance.
- Update map rendering to use backend-provided route geometry.
- Update documentation and change log entries.

### Out of scope

- Changing stop-order optimization to use travel-time matrices.
- Google Place Autocomplete migration.
- Google Geocoding migration.
- Traffic-aware routing or advanced route modifiers.
- Multi-provider fallback logic.

## Proposed Architecture

### Backend flow

1. Validate request body as it does today.
2. Geocode start, intermediate stops, and end using the existing geocoder for now.
3. Compute stop order using the existing nearest-neighbor algorithm.
4. Build trip legs from:
   - start -> first ordered stop
   - each ordered stop -> next ordered stop
   - last ordered stop -> end
5. For each leg, call Google Routes API `computeRoutes` with `travelMode: DRIVE`.
6. Collect:
   - `distanceMeters`
   - `duration`
   - encoded polyline
7. Return enriched response with per-leg and total driving metrics.

### Frontend flow

1. Submit optimize request as it does today.
2. Receive ordered stops plus leg route details.
3. Render route summary using driving distance and duration.
4. Decode or consume backend-provided route path for map rendering.
5. Preserve markers for start, stops, and end.

## Backend Change Plan

### `backend/src/app/api/optimize-route/route.ts`

Planned changes:

- Add `GOOGLE_MAPS_API_KEY` usage.
- Add a Google Routes helper for per-leg route lookup.
- Introduce a response type for route legs:
  - origin address
  - destination address
  - distance
  - duration
  - encoded polyline
- Aggregate `totalDistanceMeters` and `totalDurationSeconds` or normalized equivalents.
- Keep existing ordered stop output for compatibility, but enrich it with driving metrics where appropriate.
- Improve error mapping for Google API failures:
  - invalid config -> `500`
  - upstream rate limits / service issues -> `503`

### Proposed helper structure

Likely local helper functions inside the route handler first:

- `fetchDrivingRouteLeg`
- `buildTripLegs`
- `parseGoogleDurationSeconds`
- `sumRouteLegMetrics`

If the file becomes too large, extract Google-specific logic into a backend utility module under `backend/src/app/api/optimize-route/`.

### API response shape direction

Add a new top-level `routeLegs` array instead of overloading `orderedStops` too heavily.

Example direction:

```json
{
  "start": {},
  "end": {},
  "orderedStops": [],
  "routeLegs": [
    {
      "fromAddress": "Start",
      "toAddress": "Stop 1",
      "distanceMeters": 12345,
      "durationSeconds": 1100,
      "encodedPolyline": "..."
    }
  ],
  "totalDistanceMeters": 45678,
  "totalDurationSeconds": 3900
}
```

This keeps the existing stop model intact while giving the frontend a clean route-rendering input.

## Frontend Change Plan

### `frontend/src/components/types.ts`

Planned changes:

- Extend API response types to include:
  - `routeLegs`
  - `totalDistanceMeters`
  - `totalDurationSeconds`
- Add types for Google-derived route leg data.

### `frontend/src/components/RoutePlanner.tsx`

Planned changes:

- Update response validation to accept the new route-leg fields.
- Show trip duration in the result summary.
- Show route-based distance instead of straight-line distance.
- Optionally show per-leg drive time in the stop list or leg list.

### `frontend/src/components/RouteMap.tsx`

Planned changes:

- Stop rendering the route as straight line segments between stop coordinates.
- Render actual route geometry using backend-provided polyline data.
- Keep marker behavior for start, intermediate stops, and end.

Implementation note:

- If backend returns encoded polylines, decode them in the frontend using a small polyline decoding library or a local decoder utility.
- If backend returns decoded coordinate arrays instead, the frontend becomes simpler at the cost of larger payloads.

Recommended direction:

- Return encoded polylines from backend.
- Decode them in frontend.

This keeps payloads smaller and fits Google’s route response format naturally.

## Configuration Plan

### Backend env vars

Add:

- `GOOGLE_MAPS_API_KEY`

Keep:

- `ALLOWED_ORIGINS`

Optional for transition period:

- keep `NOMINATIM_CONTACT_EMAIL` only if geocoding remains on Nominatim

### Frontend env vars

No new frontend env vars required for Phase 1 beyond the existing `VITE_API_BASE_URL`.

## Error Handling Plan

Add clear user-facing backend messages for:

- missing Google API key
- routing request failure
- no route found between two addresses
- Google API quota/rate-limit issues

Frontend should continue showing a single friendly error banner as it does today.

## Validation Plan

### Backend verification

- `npm run lint`
- `npm run build`
- local smoke test against `POST /api/optimize-route`

### Frontend verification

- `npm run lint`
- `npm run build`
- manual map verification to confirm route path is curved/road-shaped rather than straight

### Functional checks

- zero intermediate stops
- one stop
- multiple stops
- start and end in different cities
- invalid or ungeocodable address
- missing `GOOGLE_MAPS_API_KEY`

## Risks

- Google Routes introduces per-request cost and quota constraints.
- Sequential per-leg Google calls may increase latency on routes with many stops.
- Mixed providers during transition (Nominatim geocoding + Google routing) may occasionally produce imperfect point matching.
- Response shape changes must remain compatible with current frontend expectations or be updated atomically.

## Suggested Implementation Order

1. Add backend Google Routes integration and response types.
2. Preserve current stop ordering.
3. Return route legs plus total driving metrics.
4. Update frontend types and result summary.
5. Update frontend map rendering to use actual route geometry.
6. Update docs and environment-variable instructions.
7. Verify locally and in Vercel.

## Definition Of Done

This plan is complete when:

- optimize-route returns actual driving metrics and route geometry
- frontend shows real driving distance and duration
- frontend map renders actual road routes
- local and Vercel builds pass
- required environment-variable documentation is updated
