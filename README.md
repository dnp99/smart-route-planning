# Smart Route Planner

React frontend + Next.js backend route planner.

## What it does

- User enters a **starting point**.
- User enters an **ending point**.
- User enters multiple **destination addresses** (one per line).
- Backend geocodes addresses and returns a route ordered by **nearest next stop first**, then
  ends at the provided ending point.
- Backend enriches the ordered route with **Google driving distance, duration, and route geometry**
  for each leg.
- Backend also provides **Google Places-based address suggestions** while typing.
- Frontend renders a **Leaflet map** with the actual driving path and stop markers.
- Frontend uses **Tailwind CSS** and includes a light/dark mode toggle.

## Project structure

- `frontend/` → React app (Vite)
- `backend/` → Next.js app with API route at `POST /api/optimize-route`

Frontend implementation note:
- UI logic is organized under `frontend/src/components/`.

## Run locally

Install dependencies once:

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

### 1) Backend

```bash
cd backend
cp .env.local.example .env.local
npm run dev
```

Runs on `http://localhost:3000`.

Required local backend envs live in `backend/.env.local`, for example:

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ALLOWED_ORIGINS=http://localhost:5173
OPTIMIZE_ROUTE_API_KEY=your_optional_optimize_route_key
```

### 2) Frontend

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5173`.

Frontend API base URL defaults to `http://localhost:3000`. For deployed environments, set:

```html
<script>
  window.__NAVIGATE_EASY_API_BASE_URL__ = "https://api.yourdomain.com";
</script>
```

## API request example

`POST http://localhost:3000/api/optimize-route`

```json
{
  "startAddress": "1 Apple Park Way, Cupertino",
  "endAddress": "San Francisco International Airport",
  "addresses": [
    "1600 Amphitheatre Parkway, Mountain View",
    "1 Infinite Loop, Cupertino",
    "500 Terry A Francois Blvd, San Francisco"
  ]
}
```

If `OPTIMIZE_ROUTE_API_KEY` is configured on the backend, include this header:

```http
x-optimize-route-key: your_optional_optimize_route_key
```

## Notes

- Geocoding uses OpenStreetMap Nominatim.
- Driving route distance, duration, and geometry use Google Routes API.
- Address suggestions use Google Places API.
- Route ordering uses greedy nearest-neighbor logic (nearest next stop from current stop).
- Stop ordering still uses straight-line nearest-neighbor in Phase 1, but displayed route metrics
  and map geometry are road-network based.
- Backend development uses webpack mode by default because that is the stable local startup path for this project.
