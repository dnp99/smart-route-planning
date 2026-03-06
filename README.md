# Samrt Route Planner

React frontend + Next.js backend route planner.

## What it does

- User enters a **starting point**.
- User enters an **ending point**.
- User enters multiple **destination addresses** (one per line).
- Backend geocodes addresses and returns a route ordered by **nearest next stop first**, then
  ends at the provided ending point.
- Frontend renders a **Leaflet map** with the ordered route polyline and stop markers.
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
npm run dev
```

Runs on `http://localhost:3000`.

Optional CORS allowlist:

```bash
ALLOWED_ORIGINS=http://localhost:5173 npm run dev
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

## Notes

- Geocoding uses OpenStreetMap Nominatim.
- Route ordering uses greedy nearest-neighbor logic (nearest next stop from current stop).
- Distance is based on straight-line (haversine) approximation, not road network travel time.
- Backend development uses webpack mode by default because that is the stable local startup path for this project.
