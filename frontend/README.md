# Frontend

This folder contains the Vite + React frontend for CareFlow.

## Responsibilities

- Collect starting point, ending point, and intermediate destinations.
- Require login before allowing access to patient and route-planner pages.
- Fetch Google Places-backed address suggestions from the backend autocomplete endpoint.
- Submit route optimization requests to the backend.
- Render the optimized route with Leaflet.

## Local development

```bash
npm ci
npm run dev
```

The app runs on `http://localhost:5173`.

## Runtime API configuration

The frontend reads its API base URL from `VITE_API_BASE_URL` first, then falls back to
`window.__NAVIGATE_EASY_API_BASE_URL__`.

If the value is not provided, it defaults to `http://localhost:3000`.

Example:

```bash
VITE_API_BASE_URL=https://smart-route-planning-backend.vercel.app
```

or:

```html
<script>
  window.__NAVIGATE_EASY_API_BASE_URL__ = "https://api.yourdomain.com";
</script>
```

## Key files

- `src/components/RoutePlanner.tsx` - main UI and API request flow
- `src/components/auth/LoginPage.tsx` - login screen
- `src/components/auth/authSession.ts` - local session/token storage and auth change events
- `src/components/auth/authFetch.ts` - authenticated backend fetch helper
- `src/components/AddressAutocompleteInput.tsx` - address suggestion input
- `src/components/RouteMap.tsx` - Leaflet route map
- `src/components/apiBaseUrl.ts` - runtime backend URL resolution
