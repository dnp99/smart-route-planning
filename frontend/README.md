# Frontend

This folder contains the Vite + React frontend for Routefy.

## Responsibilities

- Collect starting point, ending point, and intermediate destinations.
- Require login before allowing access to client and route-planner pages.
- Fetch Google Places-backed address suggestions from the backend autocomplete endpoint.
- Submit route optimization requests to the backend (production path: `POST /api/optimize-route/v3`) with a selectable optimization objective (`"distance"` or `"time"`) and a configurable planning date (defaults to tomorrow).
- Render the optimized route with Leaflet.
- Support manual stop reordering with recalculated ETA flow.
- Keep optimization results in memory only (no browser storage persistence).
- Restore the latest optimization result from in-memory runtime cache when navigating away and back (same tab/session state).
- Persist only non-sensitive route-planner draft state in localStorage (IDs/order/flags/date/objective/UI step).
- Keep quote/header workspace behavior consistent across auth sessions.
- Require first-use legal acknowledgement via blocking modal (`I Agree`) and re-prompt when legal notice version changes.
- Present unified overflow action menus in client list rows.
- Serve legal pages (Terms, Privacy, License, Trademark) at `/legal/*` routes.
- Show policy reminders from info icons on Clients and Route Planner pages.
- Mobile-first route planner with wizard step flow (Trip → Clients → Review), always-expanded sections on mobile, step completion indicators, and safe-area-aware sticky footer CTA.
- Use Client/Clients wording in UI copy while keeping `/api/patients` endpoints and `patient*` contract fields for backend compatibility.
- Use cookie-based auth (`credentials: "include"`) with no JWT/token storage in localStorage/sessionStorage.

## Local development

```bash
npm ci
npm run dev
```

The app runs on `http://localhost:5173`.

For Vercel hosting, `frontend/vercel.json` includes:
- an `/api/*` rewrite to the backend deployment (so browser requests stay same-origin and cookie auth remains first-party),
- deep-link rewrites such as `/patients` and `/route-planner` back to `index.html` so browser refreshes keep loading the React app instead of returning a platform `404`.

## Runtime API configuration

The frontend reads its API base URL from `VITE_API_BASE_URL` first, then falls back to
`window.__NAVIGATE_EASY_API_BASE_URL__`.

If neither is provided:
- local hosts (`localhost`, `127.0.0.1`, `::1`) default to `http://localhost:3000`,
- non-local hosts default to same-origin (`""`), which works with the `/api/*` rewrite.

Route optimizer engine selection is controlled by `VITE_ENABLE_ILS_OPTIMIZER`:

- `true`: calls `POST /api/optimize-route/v3` (current production endpoint)
- unset / `false`: calls `POST /api/optimize-route/v2` (legacy fallback)

The `v3` path keeps the same response contract as `v2`.

Example:

```bash
# Local dev
VITE_API_BASE_URL=http://localhost:3000
```

or:

```html
<script>
  window.__NAVIGATE_EASY_API_BASE_URL__ = "https://api.yourdomain.com";
</script>
```

## Key files

- `src/App.jsx` - global layout, sticky header with logo + rotating nurse quote, footer with legal links, account settings modal, legal acknowledgement flow
- `src/features/route-planner/ui/RoutePlanner.tsx` - route planner composition and workflow orchestration
- `src/features/route-planner/domain/routePlannerHelpers.ts` - destination-to-visit mapping and client search filtering
- `src/features/route-planner/domain/routePlannerSubmission.ts` - submit-time validation and request builders
- `src/features/route-planner/state/routePlannerDraft.ts` - minimized localStorage draft persistence and mobile step state
- `src/features/route-planner/hooks/useCreatePatientForm.ts` - create-client modal/form state and handlers
- `src/features/route-planner/hooks/useManualReorder.ts` - manual stop drag/reorder with stale-order tracking
- `src/features/route-planner/hooks/useRouteOptimization.ts` - optimization request state and runtime result cache lifecycle
- `src/features/route-planner/ui/OptimizedRouteResult.tsx` - dispatch plan view (stat cards, route timeline, map, warnings)
- `src/components/auth/authSession.ts` - in-memory auth user session helper and auth-change cleanup
- `src/components/auth/LoginPage.tsx` - login screen
- `src/components/auth/authFetch.ts` - authenticated backend fetch helper
- `src/components/legal/` - Terms, Privacy, License, Trademark static pages
- `src/components/modals/LegalAcknowledgementModal.tsx` - required first-use legal notice acknowledgement modal
- `src/components/AddressAutocompleteInput.tsx` - address suggestion input
- `src/components/RouteMap.tsx` - Leaflet route map
- `src/components/patients/PatientsTable.tsx` - client table with overflow action menus (Edit, Delete)
- `src/components/responsiveStyles.ts` - shared Tailwind class tokens for consistent panel/card/button styling
- `src/components/apiBaseUrl.ts` - runtime backend URL resolution
