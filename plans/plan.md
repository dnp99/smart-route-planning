# Implementation Plan & Change Log

This file documents all changes completed for the React frontend + Next.js backend route planner.

## Planning Documents

This file remains the implementation log for completed work.

Upcoming or not-yet-implemented work should be stored as separate planning documents under `plans/`.

Current active planning document:

- `plans/google-routes-phase-1-plan.md` - planned Phase 1 migration from straight-line routing to Google driving route distance, duration, and geometry

---

## 15) Google Routes Phase 1 Implementation

### Files updated
- `backend/src/app/api/optimize-route/route.ts`
- `frontend/src/components/types.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/RouteMap.tsx`
- `README.md`
- `backend/README.md`
- `frontend/README.md`
- `plans/plan.md`

### What changed
- Kept the existing nearest-neighbor stop-ordering logic in the backend.
- Added Google Routes API integration for each trip leg after stop order is chosen.
- Extended the optimize-route response with:
  - `routeLegs`
  - `totalDistanceMeters`
  - `totalDistanceKm`
  - `totalDurationSeconds`
- Updated ordered stops to include:
  - `distanceFromPreviousKm`
  - `durationFromPreviousSeconds`
- Updated the frontend result panel to display driving distance and total driving time.
- Updated the map component to decode Google encoded polylines and render the actual driving path instead of straight-line segments.
- Updated docs to describe the new `GOOGLE_MAPS_API_KEY` requirement and the Phase 1 routing behavior.

### Why
- The app needed real road-network route geometry and ETA rather than straight-line approximations.
- Phase 1 intentionally limits scope to route metrics and map rendering while preserving the existing stop-order algorithm.

### Verification
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

### Notes
- Geocoding still uses Nominatim in this phase.
- Route ordering still uses haversine nearest-neighbor in this phase.
- `GOOGLE_MAPS_API_KEY` must be set in the backend environment before the updated optimize-route API can succeed.

---

## 16) Route Summary UI Emphasis

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Moved total driving distance and total driving time to the top of the optimized-route result card.
- Increased the visual emphasis of both values with larger, bolder styling.

### Why
- The total trip summary is the most important output and should be visible before the stop-by-stop details.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 17) Backend Local Env Example

### Files updated
- `backend/.env.local.example`
- `backend/README.md`
- `README.md`
- `plans/plan.md`

### What changed
- Added a backend local environment example file with `GOOGLE_MAPS_API_KEY`, `ALLOWED_ORIGINS`, and `NOMINATIM_CONTACT_EMAIL`.
- Updated local setup docs to tell users to copy `.env.local.example` to `.env.local` before starting the backend.

### Why
- Phase 1 now requires `GOOGLE_MAPS_API_KEY`, so local setup needed an explicit, repeatable env-file path.

### Verification
- Documentation/configuration only.

---

## 18) Local Env Ignore Hardening

### Files updated
- `.gitignore`
- `plans/plan.md`

### What changed
- Added explicit ignore entries for local environment files such as `.env.local` and app-specific local env files.
- Added an explicit allow entry so `backend/.env.local.example` remains trackable.

### Why
- Local setup now uses a backend env file with secrets, so the repository ignore rules needed to make accidental commits of real API keys less likely.

### Verification
- Documentation/configuration only.

---

## 19) Google Places Autocomplete In Backend

### Files updated
- `backend/src/app/api/address-autocomplete/route.ts`
- `frontend/src/components/types.ts`
- `frontend/src/components/AddressAutocompleteInput.tsx`
- `backend/README.md`
- `frontend/README.md`
- `README.md`
- `plans/plan.md`

### What changed
- Replaced the backend autocomplete provider from Nominatim search to Google Places autocomplete.
- Updated the autocomplete response shape to use:
  - `displayName`
  - `placeId`
- Reused the existing `GOOGLE_MAPS_API_KEY` backend env var for autocomplete requests.
- Kept the frontend calling the same backend endpoint so no UI flow changes were required.

### Why
- The app already uses Google for route legs, so moving autocomplete to Google improves consistency and suggestion quality.
- Keeping the Google key in the backend avoids exposing it in the frontend.

### Verification
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 20) Custom Autocomplete Dropdown UI

### Files updated
- `frontend/src/components/AddressAutocompleteInput.tsx`
- `plans/plan.md`

### What changed
- Replaced the browser-native `datalist` autocomplete with a custom dropdown listbox.
- Added styled suggestion rows, hover/active states, and a more polished dropdown panel.
- Added keyboard navigation:
  - Arrow Up / Down
  - Enter to select
  - Escape to close
- Preserved the existing backend autocomplete endpoint and form integration.

### Why
- Native `datalist` styling is inconsistent and too limited for a polished, UI-friendly suggestion experience.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

### Follow-up fix
- Restored full-width input layout by making the autocomplete wrapper and input explicitly `w-full` after the custom dropdown replacement caused the text fields to shrink.
- Suppressed immediate re-opening of suggestions after selecting an item by tracking the selected suggestion text until the user edits the field again.

---

## 21) Editable Destination List

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Made the destination textarea editable again so users can add, remove, and update destination lines directly.
- Kept the autocomplete add flow intact.
- Added a `Clear` action for the autocomplete draft input.

### Why
- Users need to be able to edit the destination list after adding items instead of being forced into append-only behavior.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

### Follow-up fix
- Updated the destination autocomplete flow so selecting a suggestion inserts the full selected address into the destination list immediately instead of leaving the partially typed draft text in place.
- Restyled the destination count indicator as a warning/status pill so it stands out more clearly than neutral helper text.
- Replaced the editable textarea with a numbered, non-editable destination list plus per-item remove actions so numbering stays consistent and only plain address strings are sent to the backend.
- Replaced browser list markers with explicit rendered index numbers so `1.`, `2.`, `3.` remain visible regardless of layout or dark-mode styling.

---

## 22) Google Maps Planned Trip Link

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Added an `Open Planned Trip in Google Maps` link to the optimized-route section.
- Built the link from the optimized route result using:
  - `origin` = start address
  - `destination` = end address
  - `waypoints` = optimized intermediate stops only

### Why
- Users can now hand off the optimized route directly to Google Maps for live navigation using the same stop order shown in the app.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 23) Responsive Style Extraction

### Files updated
- `frontend/src/components/responsiveStyles.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/RouteMap.tsx`
- `plans/plan.md`

### What changed
- Added a dedicated responsive style module to centralize shared mobile/tablet/desktop class decisions.
- Applied the extracted responsive classes to:
  - planner page spacing
  - section headers and card padding
  - action rows and button groups
  - destination list rows and remove buttons
  - optimized-route header and Google Maps CTA
  - map height by breakpoint

### Why
- The page needed a cleaner way to manage responsive behavior without adding runtime screen-size logic.
- Centralizing the class groups keeps the JSX more maintainable while making it easier to tune mobile, tablet, and desktop layouts in one place.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 24) Optimize Button Validation Gate

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Updated the `Optimize Route` button so it is enabled only when both the starting point and ending point contain non-empty values.
- Left destination addresses optional, so the route can still be optimized with no intermediate stops.

### Why
- The app requires a valid trip start and end, but intermediate destination stops are optional.
- The button state should reflect that requirement directly in the form UI.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 25) Required Start And End Field Errors

### Files updated
- `frontend/src/components/AddressAutocompleteInput.tsx`
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Added explicit required badges to required autocomplete fields.
- Added red error styling and inline validation messaging for missing starting point and ending point fields.
- Triggered the error state after field blur or an optimize attempt so users can see why the route action is unavailable.

### Why
- The form already depends on starting and ending points, but the UI did not make that requirement explicit enough.
- Users now get immediate visual feedback instead of inferring the requirement from a disabled button alone.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 26) Default Starting Point

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Set the default starting point form value to `3361 Ingram Road, Mississauga, ON`.

### Why
- The app now opens with a prefilled start address for the intended POC workflow instead of an empty starting-point field.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 27) Suppress Initial Default Start Suggestions

### Files updated
- `frontend/src/components/AddressAutocompleteInput.tsx`
- `plans/plan.md`

### What changed
- Treated the initial input value as an already selected suggestion so the autocomplete component does not call the Google suggestions API immediately for the prefilled default starting point.
- Kept the normal autocomplete behavior after the user edits the field.

### Why
- The default starting point is a convenience value, not a user query.
- Avoiding the initial request reduces unnecessary Google Places usage while preserving suggestions once the field is actively edited.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 28) Theme-Aware Disabled Optimize Button

### Files updated
- `frontend/src/components/responsiveStyles.ts`
- `plans/plan.md`

### What changed
- Changed the disabled `Optimize Route` button styling to be theme-aware:
  - light mode uses a neutral slate disabled treatment
  - dark mode uses the desaturated navy treatment

### Why
- The dark-mode navy treatment looked acceptable, but it felt too heavy in light mode.
- Using separate disabled colors per theme keeps the button clearly inactive without clashing with the surrounding surface.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 29) ETA Clarification Copy

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `plans/plan.md`

### What changed
- Renamed `Total driving time` to `Estimated driving time` in the optimized route summary.
- Added a note under the Google Maps trip link explaining that Google Maps may show a different ETA based on live traffic.

### Why
- The app currently uses a non-traffic-aware Google Routes request, while Google Maps may recalculate with live traffic and different address resolution.
- The UI should make that distinction explicit so users do not assume both ETA values must match exactly.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 30) Optimized Route Section UI Polish

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/responsiveStyles.ts`
- `plans/plan.md`

### What changed
- Reworked the optimized-route header into a clearer title plus supporting description.
- Restyled the Google Maps ETA disclaimer as a softer inline info note.
- Replaced the stacked summary text block with two stat cards for distance and estimated time.
- Grouped the start and end addresses into a dedicated metadata block with lighter visual separation.

### Why
- The previous layout felt like a stack of similar bordered boxes and helper text.
- Breaking the section into header, note, stat cards, and endpoint metadata gives it clearer hierarchy and better scanability on both mobile and desktop.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

### Follow-up adjustment
- Reordered the optimized-route content so the Google Maps CTA appears first, followed by the info note, the route map, and then the summary/detail cards.
- This brings the visual route and navigation action higher in the section hierarchy.
- Updated the Google Maps CTA to a green-accent treatment and the supporting info note to a neutral slate treatment so they no longer blend into the surrounding blue-toned card.
- Refined the info note with a lighter layout and subtle info icon so it reads as guidance instead of another heavy callout.
- Simplified the top layout into a full-width vertical stack so the CTA, info note, and summary cards no longer sit in an awkward right-heavy desktop arrangement.
- Kept the distance and estimated-time cards above the map, but removed the forced desktop width coupling that made the section feel unbalanced.
- Reduced the distance and estimated-time card height by tightening padding and value/meta spacing so the summary block feels less bulky.
- Aligned the distance and estimated-time card containers with the same visual style as the start/end cards to reduce competing card treatments in the section.
- Further compacted the distance and estimated-time cards by keeping the meta line but reducing padding and value sizing so they read as tighter summary blocks without losing context.
- Upgraded the Leaflet route map with explicit `S / 1 / 2 / … / E` markers, clearer start/end distinction, stronger route fit padding, and a two-layer polyline so the route path stands out more clearly against the tile background.
- Moved the theme toggle into the top title row and converted it to an icon-only button so it sits in the top-right corner beside `Smart Route Planner` instead of consuming its own full-width row.
- Changed the app’s default theme fallback to dark mode and expanded the theme-toggle tooltip text so the icon clearly communicates the current theme state and the click action.
- Added a subtle `Optimize Route` animation treatment:
  - press feedback on click
  - shimmer while loading
  - short success pulse after a successful route result
  - reduced-motion fallback to disable the effect when appropriate
- Fixed a Leaflet regression in the custom route-marker pass by switching the `Marker` prop from `center` to `position`, which resolved the `Cannot read properties of undefined (reading 'lat')` runtime error after route optimization.
- Added an expandable full-size map option in the optimized-route section with:
  - an `Expand map` control on the embedded Leaflet map
  - a fullscreen overlay route view
  - close and Escape-key support for returning to the normal summary layout
- Updated the optimized-route stop list so it is hidden when the trip has no intermediate destinations and only contains the ending point.
- Updated the frontend browser-tab title from the scaffold default to `Smart Route Planner`.
- Replaced the default Vite browser-tab icon with a custom car favicon for the frontend.

---

## 31) Remove Analytics Feature

### Files updated
- `backend/src/app/api/optimize-route/route.ts`
- `backend/src/app/api/address-autocomplete/route.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `README.md`
- `backend/README.md`
- `plans/plan.md`

### Files deleted
- `backend/src/app/api/analytics/route.ts`
- `backend/src/lib/analytics.ts`
- `frontend/src/components/AdminDebugPanel.tsx`

### What changed
- Removed all backend analytics event tracking and analytics snapshot functionality.
- Removed the analytics API endpoint (`GET /api/analytics`).
- Removed the frontend analytics debug modal and its header trigger from the route planner UI.
- Removed analytics-related documentation and environment-variable mentions.
- Verified no remaining analytics/debug references in source docs and code.

### Why
- The analytics feature was explicitly requested to be removed.
- Keeping analytics hooks, endpoint surface, and debug UI after feature removal would leave dead code and unnecessary maintenance overhead.

### Verification
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Repo-wide checks:
  - search for `analytics|ANALYTICS_API_KEY|/api/analytics|AdminDebugPanel` returned no matches ✅

## 1) Project Scaffolding

### Created app structure
- `frontend/` created with **Vite + React** template.
- `backend/` created with **Next.js (App Router) + TypeScript + ESLint**.

### Installed dependencies
- Frontend: installed Vite/React dependencies from generated template.
- Backend: installed Next.js dependencies from generated template.

---

## 2) Backend Changes (Next.js API)

### Added route optimization API
- **File added:** `backend/src/app/api/optimize-route/route.ts`
- **Endpoint:** `POST /api/optimize-route`

### Core behavior implemented
- Accepts:
  - `startAddress: string`
  - `addresses: string[]`
- Geocodes start and destination addresses using **OpenStreetMap Nominatim**.
- Computes route order using **greedy nearest-neighbor** from the current point:
  - chooses closest next stop first,
  - repeats until all stops are visited.
- Returns:
  - `start`
  - `orderedStops` with per-leg distance
  - `totalDistanceKm`

### Validation & reliability hardening
- Added strict request validation:
  - JSON body required,
  - `startAddress` must be string,
  - `addresses` must be array of strings.
- Added request limits:
  - max destinations: `25`,
  - max address length: `200` chars.
- Handles edge cases:
  - empty start address,
  - no destinations,
  - destinations equal to start.
- Added geocoding timeout (`AbortController`, 8s).
- Added clearer status mapping:
  - `400` for invalid input / un-geocodable address,
  - `503` for upstream geocoding service issues/rate limits,
  - `500` fallback for unknown server errors.

### CORS behavior
- Implemented `OPTIONS` handler.
- Added dynamic CORS headers via `ALLOWED_ORIGINS` env var.
- Defaults to `*` when no allowlist is configured.

### Distance calculations
- Uses **haversine** formula for straight-line approximation.
- Per-leg distances rounded for output.
- Total distance calculated from full-precision sums, then rounded.

---

## 3) Frontend Changes (React)

### Replaced starter UI
- **Updated:** `frontend/src/App.jsx`
- Removed Vite sample counter/logo UI.

### Added route planner interface
- Input for starting address.
- Multi-line textarea for destination addresses (one per line).
- Submit button to optimize route.
- Destination count indicator.
- Loading and error handling states.

### API integration
- Frontend sends POST request to:
  - `${VITE_API_BASE_URL}/api/optimize-route`
- Request payload built from user input.
- Displays response:
  - start address,
  - ordered stops,
  - leg distances,
  - total distance.

### Styling
- **Updated:** `frontend/src/App.css`
- **Updated:** `frontend/src/index.css`
- Added clean card-based layout, form styles, error banner, and result section styles.

---

## 4) Configuration & Documentation

### Environment sample
- **Added:** `frontend/.env.example`
  - `VITE_API_BASE_URL=http://localhost:3000`

### Backend build warning fix
- **Updated:** `backend/next.config.ts`
- Set `turbopack.root` to `process.cwd()` to prevent workspace root warning.

### Project README
- **Added:** `README.md`
- Includes:
  - app purpose,
  - folder structure,
  - local run instructions,
  - API request example,
  - note about straight-line distance approximation.

---

## 5) External Review Applied

An Oracle review was performed and its recommendations were incorporated, including:
- stronger input validation,
- better status code mapping,
- geocoding timeout/error handling,
- improved total distance precision,
- CORS allowlist support,
- explicit note that distance is straight-line, not road-network optimized.

---

## 6) Verification Performed

### Backend
- Ran: `npm run lint && npm run build`
- Result: ✅ passed

### Frontend
- Ran: `npm run lint && npm run build`
- Result: ✅ passed

### Notes
- LSP diagnostics tool was unavailable in this environment due to missing local language server binaries.
- Lint + type/build verification completed successfully for both apps.

---

## 7) Governance Update

### Added repository agent policy
- **Added:** `AGENT.md` at repository root.
- Policy introduced:
  - Every code change must be documented in `plan.md`.
  - `plan.md` must be updated in the same session with changed files, rationale, and verification results.
  - Rule applies across frontend, backend, config, docs, and infrastructure updates.

---

## 8) Leaflet Route Map Visualization

### Frontend mapping dependencies
- **Updated:** `frontend/package.json` and `frontend/package-lock.json`
- Installed:
  - `leaflet`
  - `react-leaflet`

### New map component
- **Added:** `frontend/src/RouteMap.jsx`
- Implemented:
  - OpenStreetMap tile layer,
  - route polyline (start + ordered stops),
  - marker visualization using circle markers,
  - auto-fit behavior to keep full route in view.

### UI integration
- **Updated:** `frontend/src/App.jsx`
  - Injected `RouteMap` inside the optimized route result panel.
- **Updated:** `frontend/src/main.jsx`
  - Imported Leaflet stylesheet: `leaflet/dist/leaflet.css`.
- **Updated:** `frontend/src/App.css`
  - Added map container and sizing styles.

### Documentation update
- **Updated:** `README.md`
  - Added note that frontend now includes Leaflet route visualization.

### Verification for map feature
- Frontend run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Backend regression run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- LSP diagnostics attempt on modified frontend JS files:
  - Tool unavailable in this environment (missing `typescript-language-server`).

---

## 9) Ending Point Support

### Backend API enhancements
- **Updated:** `backend/src/app/api/optimize-route/route.ts`
- Request contract now includes required:
  - `startAddress`
  - `endAddress`
  - `addresses[]` (intermediate stops, optional)
- Validation added for `endAddress` type, required presence, and max length.
- Intermediate destination filtering now excludes entries matching start or end.
- Geocoding flow updated to geocode unique addresses in sequence (rate-friendly).
- Route logic updated to always append ending point as final stop with:
  - `isEndingPoint: true`
  - final leg distance from previous stop.
- Response now includes:
  - `start`
  - `end`
  - `orderedStops` (ending point is last item)
  - `totalDistanceKm`

### Frontend changes for end point
- **Updated:** `frontend/src/App.jsx`
  - Added required "Ending point" input field.
  - Included `endAddress` in API payload.
  - Destination textarea changed to optional intermediate stops.

---

## 10) Repository Initialization

### Git setup
- **Added:** `.gitignore`
- **Updated:** root repository metadata
- Initialized a new Git repository at the project root.
- Removed nested Git metadata from `backend/.git` so the backend is tracked inside the root repository.
- Renamed the default branch to `main`.
- Added GitHub SSH remote:
  - `git@github.com:dvnp19/smart-route-planner.git`

### Why
- The project needed a single root repository so frontend, backend, docs, workflows, and scripts are versioned together.
- A root `.gitignore` was needed so dependencies, build outputs, and local editor files are not committed.

### Verification
- Confirmed current branch is `main`.
- Confirmed `git remote -v` points to the provided GitHub SSH origin.
- Created initial commit successfully.

---

## 11) Docs And Local Runtime Cleanup

### Files updated
- `README.md`
- `frontend/README.md`
- `backend/README.md`
- `backend/package.json`
- `backend/src/app/layout.tsx`

### What changed
- Replaced scaffold README content in frontend and backend with project-specific documentation.
- Corrected the root quickstart to remove the missing `.env.example` step and document the runtime API base URL behavior.
- Changed backend `npm run dev` to use `next dev --webpack` by default to match the working local development path.
- Removed `next/font/google` usage from the backend layout and switched to the existing CSS font stack.
- Updated backend metadata text to reflect the actual project instead of the create-next-app defaults.

### Why
- The repository docs did not match the current application structure or local startup flow.
- Local backend development was more reliable with webpack than the default Turbopack path in this environment.
- Backend production builds were not self-contained because they depended on fetching Google fonts during `next build`.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 12) Remove GitHub Workflows

### Files updated
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `plan.md`

### What changed
- Removed the GitHub Actions CI workflow.
- Removed the GitHub Actions deploy workflow.

### Why
- The workflows are being disabled for now and should no longer run from this repository.

### Verification
- Confirmed both workflow files were removed from the working tree.

---

## 13) Frontend Vercel API Configuration

### Files updated
- `frontend/src/components/apiBaseUrl.ts`
- `plan.md`

### What changed
- Updated frontend API base URL resolution to support `import.meta.env.VITE_API_BASE_URL`.
- Added URL normalization so configured values do not keep trailing slashes.
- Preserved the existing runtime `window.__NAVIGATE_EASY_API_BASE_URL__` override and localhost fallback.

### Why
- The frontend needed a build-time configuration path for Vercel so production requests can target the deployed backend instead of `http://localhost:3000`.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 14) Vercel Linux Build Fix

### Files updated
- `frontend/package.json`
- `frontend/package-lock.json`
- `plan.md`

### What changed
- Removed the explicit `@rollup/rollup-darwin-arm64` dev dependency from the frontend project.

### Why
- That package is macOS ARM-only.
- Vercel builds the frontend on Linux, so the explicit dependency caused `EBADPLATFORM` and blocked deployment.
- Rollup already manages platform-specific native packages through its own optional dependency tree, so the explicit top-level dependency was not safe to keep.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 10) Repository Initialization

### Git setup
- **Updated:** repository metadata at project root
- Initialized a new Git repository at the project root.
- Removed nested Git metadata from `backend/.git` so the backend is tracked as part of the root repository instead of as an embedded repository.
- Renamed the root default branch from `master` to `main`.

### Why
- The project was split between an unversioned root folder and a nested backend repository.
- A single root repository is the correct structure for tracking `frontend/`, `backend/`, docs, and scripts together.

### Verification
- Confirmed root `.git/` exists.
- Confirmed `backend/.git` no longer exists.
- Verified `git status` runs from the project root.

  - Results panel now shows both start and end addresses.
  - Final stop row is labeled as ending point.

### Map visualization update
- **Updated:** `frontend/src/RouteMap.jsx`
  - Detects final stop via `isEndingPoint`.
  - Displays ending point marker as red and labeled "End".

### Documentation update
- **Updated:** `README.md`
  - Added ending point behavior to feature list and API request example.

### Verification for ending point feature
- Frontend run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Backend run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Runtime API smoke test:
  - `POST /api/optimize-route` with `startAddress`, `endAddress`, and intermediate `addresses`
  - Result: ✅ response includes `end` object and final `orderedStops` item with `isEndingPoint: true`.

---

## 10) Frontend Component Refactor + Tailwind + Theme Toggle

### Tailwind CSS migration
- **Updated:** `frontend/package.json`, `frontend/package-lock.json`
- Installed tooling:
  - `tailwindcss@3`
  - `postcss`
  - `autoprefixer`
- **Added:** `frontend/tailwind.config.js`
  - Configured content globs for Vite React files.
  - Enabled `darkMode: 'class'`.
- **Added:** `frontend/postcss.config.js`
- **Updated:** `frontend/src/index.css`
  - Replaced prior custom stylesheet with Tailwind directives (`@tailwind base/components/utilities`).
  - Added dark/light base body styles using Tailwind utilities.

### Components folder refactor
- **Added:** `frontend/src/components/RoutePlanner.jsx`
  - Moved route planner state + form submit logic from `App.jsx` into a dedicated component.
  - Preserved API integration and result rendering behavior.
- **Added:** `frontend/src/components/RouteMap.jsx`
  - Moved Leaflet map logic under `components/`.
- **Added:** `frontend/src/components/ThemeToggle.jsx`
  - Added explicit dark/light mode toggle UI.
- **Updated:** `frontend/src/App.jsx`
  - Simplified to render `RoutePlanner` only.
- **Deleted:** `frontend/src/RouteMap.jsx`
  - Replaced by `frontend/src/components/RouteMap.jsx`.
- **Deleted:** `frontend/src/App.css`
  - Replaced by Tailwind utility classes.

### Theme behavior
- Theme initialization uses:
  - persisted `localStorage` theme if present,
  - otherwise system preference via `prefers-color-scheme`.
- Theme updates apply/removes the `dark` class on `document.documentElement`.

### Documentation update
- **Updated:** `README.md`
  - Added Tailwind + light/dark mode note.
  - Added note that frontend UI logic is organized under `src/components/`.

### Verification for refactor/theme work
- LSP diagnostics attempts on modified frontend JS files:
  - Tool unavailable in this environment (missing `typescript-language-server`).
- Frontend run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Backend regression run:
  - `npm run lint && npm run build`
  - Result: ✅ passed

---

## 11) Components Folder Migrated to TSX

### TSX conversion in `frontend/src/components`
- **Added:** `frontend/src/components/types.ts`
  - Shared types for theme and route API response (`Theme`, `OptimizeRouteResponse`, stop/co-ordinate types).
- **Added:** `frontend/src/components/RoutePlanner.tsx`
  - Converted planner component to TSX with typed state and submit handler.
  - Added response shape guard before setting route result state.
- **Added:** `frontend/src/components/RouteMap.tsx`
  - Converted Leaflet map component to TSX with typed props and map point tuples.
- **Added:** `frontend/src/components/ThemeToggle.tsx`
  - Converted theme toggle component to TSX with typed props.

### Removed JSX versions
- **Deleted:** `frontend/src/components/RoutePlanner.jsx`
- **Deleted:** `frontend/src/components/RouteMap.jsx`
- **Deleted:** `frontend/src/components/ThemeToggle.jsx`

### Verification for TSX migration
- LSP diagnostics attempts on new TSX component files:
  - Tool unavailable in this environment (missing `typescript-language-server`).
- Frontend run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Backend regression run:
  - `npm run lint && npm run build`
  - Result: ✅ passed
- Runtime checks with local servers:
  - `GET http://localhost:5173` returned `200`.
  - `POST http://localhost:3000/api/optimize-route` returned valid route JSON.
