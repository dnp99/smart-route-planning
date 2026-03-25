# Frontend

This folder contains the Vite + React frontend for CareFlow.

## Responsibilities

- Collect starting point, ending point, and intermediate destinations.
- Require login before allowing access to patient and route-planner pages.
- Fetch Google Places-backed address suggestions from the backend autocomplete endpoint.
- Submit route optimization requests to the backend with a selectable optimization objective (`"distance"` or `"time"`) and a configurable planning date (defaults to tomorrow).
- Render the optimized route with Leaflet.
- Support manual stop reordering with recalculated ETA flow.
- Persist optimization result in sessionStorage across tab switches; clear on auth change.
- Keep quote/header workspace behavior consistent across auth sessions.
- Present unified overflow action menus in patient list rows.
- Serve legal pages (Terms, Privacy, License, Trademark) at `/legal/*` routes.
- Mobile-first route planner with wizard step flow (Trip → Patients → Review), always-expanded sections on mobile, step completion indicators, and safe-area-aware sticky footer CTA.

## Local development

```bash
npm ci
npm run dev
```

The app runs on `http://localhost:5173`.

For Vercel hosting, `frontend/vercel.json` rewrites deep links such as `/patients` and `/route-planner` back to `index.html` so browser refreshes keep loading the React app instead of returning a platform `404`.

## Runtime API configuration

The frontend reads its API base URL from `VITE_API_BASE_URL` first, then falls back to
`window.__NAVIGATE_EASY_API_BASE_URL__`.

If the value is not provided, it defaults to `http://localhost:3000`.

Route optimizer engine selection is controlled by `VITE_ENABLE_ILS_OPTIMIZER`:

- unset / `false`: calls `POST /api/optimize-route/v2`
- `true`: calls `POST /api/optimize-route/v3`

The `v3` path keeps the same response contract as `v2`.

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

- `src/App.jsx` - global layout, sticky header with logo + rotating nurse quote, footer with legal links, account settings modal
- `src/components/RoutePlanner.tsx` - route planner composition and workflow orchestration
- `src/components/routePlanner/routePlannerHelpers.ts` - destination-to-visit mapping and patient search filtering
- `src/components/routePlanner/routePlannerSubmission.ts` - submit-time validation and request builders
- `src/components/routePlanner/routePlannerDraft.ts` - localStorage draft persistence and mobile step state
- `src/components/routePlanner/useCreatePatientForm.ts` - create-patient modal/form state and handlers
- `src/components/routePlanner/useManualReorder.ts` - manual stop drag/reorder with stale-order tracking
- `src/components/routePlanner/useRouteOptimization.ts` - optimization request state with sessionStorage persistence
- `src/components/routePlanner/OptimizedRouteResult.tsx` - dispatch plan view (stat cards, route timeline, map, warnings)
- `src/components/auth/authSession.ts` - local session/token storage, session-scoped key cleanup on auth change
- `src/components/auth/LoginPage.tsx` - login screen
- `src/components/auth/authFetch.ts` - authenticated backend fetch helper
- `src/components/legal/` - Terms, Privacy, License, Trademark static pages
- `src/components/AddressAutocompleteInput.tsx` - address suggestion input
- `src/components/RouteMap.tsx` - Leaflet route map
- `src/components/patients/PatientsTable.tsx` - patient table with overflow action menus (Edit, Delete)
- `src/components/responsiveStyles.ts` - shared Tailwind class tokens for consistent panel/card/button styling
- `src/components/apiBaseUrl.ts` - runtime backend URL resolution
