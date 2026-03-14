# Change Log

This file documents all changes completed for the React frontend + Next.js backend route planner.

## Planning Documents

This file remains the implementation log for completed work.

Note: this change log was renamed from `plans/plan.md` to `plans/change-log.md`. Older entries may reference the previous path.

Upcoming or not-yet-implemented work should be stored as separate planning documents under `plans/`.

Current planning documents:

- `plans/nurse-patient-management-execution-plan.md` - patient management feature execution plan
- `plans/jwt-authentication-execution-plan.md` - JWT authentication rollout execution plan

---

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

## 10) Repository Initialization

---

## 11) CareFlow UI Polish and Drizzle Migration Repair

### Patients page and route planner polish
- Updated the CareFlow UI to make the Patients page and Route Planner feel more consistent for demos.
- Standardized shared surface, panel, and search-input styling.
- Aligned Route Planner patient-search, selected-destination, and results sections with the Patients page treatment.
- Simplified the Patients page search/list wrapper to remove unnecessary extra mobile padding.

### Branding and layout continuity
- Continued the CareFlow presentation work by keeping header, page shell, and card spacing visually aligned across routes.
- Preserved responsive behavior for desktop and mobile while reducing redundant nested containers.

### Backend migration pipeline repair
- Replaced the hand-written initial SQL migration with a Drizzle-managed baseline migration.
- Added:
  - `backend/drizzle/0000_swift_shiver_man.sql`
  - `backend/drizzle/meta/0000_snapshot.json`
  - `backend/drizzle/meta/_journal.json`
- Updated:
  - `backend/drizzle.config.ts`
  - `backend/package.json`
- Added `db:generate` so future schema changes can generate tracked migrations before `db:migrate`.
- Switched Drizzle migration output to `backend/drizzle/` so `drizzle-kit migrate` now has the required journal metadata.
- Included `pgcrypto` extension creation and idempotent `default-nurse` seed in the baseline migration.

### Documentation updates
- Updated:
  - `backend/README.md`
- Documented the new migration flow:
  - use `DATABASE_URL_UNPOOLED` for migration runs,
  - use `DATABASE_URL` for deployed runtime,
  - run `npm run db:generate` when schema changes,
  - run `npm run db:migrate` to apply committed migrations.

### Completed setup follow-through
- The temporary planning checklist `plans/vercel-database-setup-checklist.md` was removed after the Neon/Vercel database setup was completed and validated.

### Verification
- Frontend:
  - `npm test`
  - Result: ✅ `40/40` tests passed
- Backend migration generation:
  - `npm run db:generate`
  - Result: ✅ baseline migration and Drizzle metadata created successfully

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

## 11) Frontend Component Refactor + Tailwind + Theme Toggle

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

## 12) Components Folder Migrated to TSX

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

---

## 13) Docs And Local Runtime Cleanup

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

## 14) Remove GitHub Workflows

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

## 15) Frontend Vercel API Configuration

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

## 16) Vercel Linux Build Fix

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

## 17) Google Routes Phase 1 Implementation

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

## 18) Route Summary UI Emphasis

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

## 19) Backend Local Env Example

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

## 20) Local Env Ignore Hardening

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

## 21) Google Places Autocomplete In Backend

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

## 22) Custom Autocomplete Dropdown UI

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

## 23) Editable Destination List

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

## 24) Google Maps Planned Trip Link

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

## 25) Responsive Style Extraction

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

## 26) Optimize Button Validation Gate

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

## 27) Required Start And End Field Errors

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

## 28) Default Starting Point

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

## 29) Suppress Initial Default Start Suggestions

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

## 30) Theme-Aware Disabled Optimize Button

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

## 31) ETA Clarification Copy

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

## 32) Optimized Route Section UI Polish

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

## 33) Remove Analytics Feature

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

---

## 34) Mandatory Pull-Main-Then-Branch Workflow

### Files updated
- `AGENT.md`
- `plan.md`
- `plans/plan.md`

### What changed
- Added a mandatory branch workflow rule to `AGENT.md` requiring:
  - `git switch main`
  - `git pull --ff-only origin main`
  - `git switch -c <descriptive-branch-name>`
- Added a recovery procedure in `AGENT.md` for accidental commits on `main`.
- Updated both plan files to record this governance/process change.

### Why
- `main` is protected and should remain commit-clean.
- A strict pull-main-then-branch workflow prevents accidental direct commits on `main` and keeps feature branches based on the latest upstream state.

### Verification
- Documentation/process change only.
- Verified `AGENT.md` contains the new mandatory workflow and recovery steps.
- Verified the change is logged in both `plan.md` and `plans/change-log.md`.

---

## 35) Shared Backend HTTP/CORS/Error Helpers

### Files added
- `backend/src/lib/http.ts`

### Files updated
- `backend/src/app/api/optimize-route/route.ts`
- `backend/src/app/api/address-autocomplete/route.ts`
- `plan.md`
 - `plans/change-log.md`

### What changed
- Extracted shared backend HTTP concerns into `backend/src/lib/http.ts`:
  - `HttpError`
  - `buildCorsHeaders`
  - `toErrorResponse`
- Added explicit CORS origin-policy support in the shared helper:
  - `fallback-first` (used by optimize-route)
  - `strict` (used by address-autocomplete)
- Updated both API routes to import and use the shared helpers instead of route-local duplicates.
- Simplified route-level error responses by centralizing unknown/HttpError handling via `toErrorResponse`.

### Why
- Both API handlers had duplicated HTTP/CORS/error boilerplate that could diverge over time.
- A shared helper keeps route files focused on endpoint logic and makes CORS/error behavior consistent and easier to maintain.
- Preserving explicit per-route origin policy keeps existing intent clear while removing duplication.

### Verification
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Duplication check:
  - `backend/src/app/api/*/route.ts` no longer define local `HttpError`, `resolveAllowedOrigin`, or `buildCorsHeaders` ✅

---

## 36) Split Optimize Route Backend and RoutePlanner Frontend Modules

### Files added
- `backend/src/app/api/optimize-route/types.ts`
- `backend/src/app/api/optimize-route/validation.ts`
- `backend/src/app/api/optimize-route/geocoding.ts`
- `backend/src/app/api/optimize-route/routing.ts`
- `backend/src/app/api/optimize-route/optimizeRouteService.ts`
- `frontend/src/components/routePlanner/routePlannerUtils.ts`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/components/routePlanner/useTheme.ts`
- `frontend/src/components/routePlanner/useDestinationAddresses.ts`
- `frontend/src/components/routePlanner/useRouteOptimization.ts`

### Files updated
- `backend/src/app/api/optimize-route/route.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `plan.md`
- `plans/plan.md`

### What changed
- Refactored optimize-route backend into smaller modules:
  - request validation logic moved to `validation.ts`
  - geocoding IO logic moved to `geocoding.ts`
  - route ordering + Google Routes leg logic moved to `routing.ts`
  - orchestration moved to `optimizeRouteService.ts`
  - shared route types moved to `types.ts`
- Slimmed `backend/src/app/api/optimize-route/route.ts` into a thin HTTP handler that only handles CORS, request JSON parsing, env checks, and response mapping.
- Refactored `RoutePlanner.tsx` by extracting:
  - theme state/effects to `useTheme.ts`
  - destination list state/operations to `useDestinationAddresses.ts`
  - optimize-route request lifecycle (loading/result/error/success state) to `useRouteOptimization.ts`
  - API request contract/response guards to `routePlannerService.ts`
  - display/URL pure helpers to `routePlannerUtils.ts`
- Kept existing API payload shape and visible UI behavior intact.

### Why
- The previous backend route and frontend component combined many responsibilities in single files.
- Splitting into pure modules/hooks/services improves readability and long-term maintainability while preserving current functionality.

### Verification
- Backend:
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 37) Backend Tests for Validation, Error Mapping, and Response Shaping

### Files added
- `backend/src/app/api/optimize-route/validation.test.ts`
- `backend/src/app/api/optimize-route/route.test.ts`
- `backend/src/app/api/optimize-route/optimizeRouteService.test.ts`

### Files updated
- `backend/package.json`
- `backend/package-lock.json`
- `plan.md`
- `plans/plan.md`

### What changed
- Added backend test runner support with Vitest (`npm run test`).
- Added request validation tests for `parseAndValidateBody` covering normalization and error cases.
- Added route handler tests for `/api/optimize-route` covering:
  - missing API key mapping to 500
  - invalid JSON mapping to 400
  - `HttpError` mapping to exact status/message
  - unknown errors mapping to generic 500
  - success response payload passthrough/shape
- Added optimize service tests covering:
  - route response shaping from service orchestration
  - destination filtering and geocode input deduplication
  - incomplete geocode lookup mapping to `HttpError(500)`

### Why
- Tests were requested before additional large refactors.
- This coverage hardens core request handling and output shaping behavior so future structural changes are safer.

### Verification
- Backend:
  - `npm run test` ✅ (11 tests)
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend regression:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 38) Frontend Unit Tests for RoutePlanner Utilities and Service

### Files added
- `frontend/src/components/routePlanner/routePlannerUtils.test.ts`
- `frontend/src/components/routePlanner/routePlannerService.test.ts`

### Files updated
- `frontend/package.json`
- `frontend/package-lock.json`
- `plan.md`
- `plans/plan.md`

### What changed
- Added frontend Vitest support via `npm run test` script.
- Added utility tests for `routePlannerUtils.ts`:
  - duration formatting behavior
  - Google Maps URL shaping with origin/destination/waypoints
- Added service tests for `routePlannerService.ts`:
  - successful response pass-through for valid payloads
  - backend error-message mapping on non-OK responses
  - fallback error message on non-OK responses without `error` string
  - invalid OK payload shape rejection

### Why
- Frontend unit tests were requested so core route-planner utility and request-shaping behavior is protected before larger UI refactors.

### Verification
- Frontend:
  - `npm run test` ✅ (6 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 39) Backend Coverage Raised to 100%

### Files added
- `backend/vitest.config.ts`
- `backend/src/lib/http.test.ts`
- `backend/src/app/api/address-autocomplete/route.test.ts`
- `backend/src/app/api/optimize-route/geocoding.test.ts`
- `backend/src/app/api/optimize-route/routing.test.ts`

### Files updated
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app/api/address-autocomplete/route.ts`
- `backend/src/app/api/optimize-route/validation.test.ts`
- `backend/src/app/api/optimize-route/route.test.ts`
- `backend/src/app/api/optimize-route/geocoding.test.ts`
- `backend/src/app/api/optimize-route/routing.test.ts`
- `plan.md`
- `plans/plan.md`

### What changed
- Added strict Vitest coverage configuration for backend API/lib targets with global thresholds set to 100% for statements, branches, functions, and lines.
- Added dedicated backend unit/integration-style tests for:
  - shared HTTP helpers (`buildCorsHeaders`, `toErrorResponse`)
  - optimize-route geocoding and routing branches (including timeout-abort paths)
  - optimize-route route handler `OPTIONS`/error branches
  - address-autocomplete route branches (CORS strict/fallback, cache hit/expiry, rate limiting, IP key resolution, upstream failure mappings)
- Expanded existing validation tests to cover all validation branches.
- Simplified one internal parsing expression in `address-autocomplete/route.ts` (`split(...)[0].trim()`) to remove an unreachable optional-chain branch and make branch instrumentation deterministic.

### Why
- Backend coverage was explicitly requested at 100%.
- Full branch coverage ensures request validation, error mapping, and response shaping paths are protected during future refactors.

### Verification
- Backend coverage:
  - `npm run test:coverage` ✅
  - Result: **100% statements / 100% branches / 100% functions / 100% lines**
- Backend quality/build:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 40) Frontend Coverage Increased to >=80%

### Files added
- `frontend/vitest.config.ts`
- `frontend/src/components/apiBaseUrl.test.ts`
- `frontend/src/components/routePlanner/useTheme.test.ts`
- `frontend/src/components/routePlanner/useDestinationAddresses.test.ts`
- `frontend/src/components/routePlanner/useRouteOptimization.test.ts`

### Files updated
- `frontend/package.json`
- `frontend/package-lock.json`
- `plan.md`
- `plans/plan.md`

### What changed
- Added frontend coverage configuration with enforced thresholds (80%) for statements, branches, functions, and lines.
- Added test coverage scope for key frontend planner modules:
  - `src/components/apiBaseUrl.ts`
  - `src/components/routePlanner/**/*.ts`
- Added frontend unit tests for:
  - API base URL resolution (`apiBaseUrl.test.ts`)
  - theme hook behavior (`useTheme.test.ts`)
  - destination list hook behavior (`useDestinationAddresses.test.ts`)
  - route optimization hook behavior (`useRouteOptimization.test.ts`)

### Why
- Frontend coverage increase to at least 80% was explicitly requested.
- The added tests cover core route-planner state and service logic that is most likely to regress during UI refactors.

### Verification
- Frontend coverage:
  - `npm run test:coverage` ✅
  - Result: **97.61% statements / 93.22% branches / 100% functions / 97.60% lines**
- Frontend quality/build:
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 41) Optimize-Route Hardening + Backend Status Page + CI Quality Gates

### Files added
- `.github/workflows/ci.yml`
- `backend/src/app/api/optimize-route/requestGuards.ts`
- `backend/src/app/api/optimize-route/requestGuards.test.ts`

### Files updated
- `backend/src/app/api/optimize-route/route.ts`
- `backend/src/app/api/optimize-route/route.test.ts`
- `backend/src/app/page.tsx`
- `backend/.env.local.example`
- `backend/README.md`
- `README.md`
- `plan.md`
- `plans/plan.md`

### Files deleted
- `backend/src/app/page.module.css`

### What changed
- Hardened `POST /api/optimize-route` with:
  - optional API key protection (`OPTIMIZE_ROUTE_API_KEY` + `x-optimize-route-key` header)
  - per-client in-memory rate limiting (`OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS`, `OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS`)
  - CORS preflight header allowance for `x-optimize-route-key`
- Added focused guard tests (`requestGuards.test.ts`) and route-level tests for:
  - missing/matching optimize-route API key behavior
  - rate-limit behavior and 429 mapping
  - updated OPTIONS CORS header assertions
- Replaced default backend scaffold page with a minimal backend status page and removed unused scaffold CSS.
- Added CI workflow (`.github/workflows/ci.yml`) with quality gates for both backend and frontend:
  - install dependencies
  - lint
  - coverage tests
  - build

### Why
- `/api/optimize-route` is a high-cost endpoint (geocoding + routing calls) and needed stronger abuse/cost controls.
- Removing scaffold leftovers improves repository hygiene and clarity.
- CI quality gates are needed so lint/test/build regressions are blocked on PRs and pushes.

### Verification
- Backend:
  - `npm run test:coverage` ✅
  - Result: **100% statements / 100% branches / 100% functions / 100% lines**
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run test:coverage` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 42) Production Optimize-Route API Key Status Note

### Files updated
- `README.md`
- `plan.md`
- `plans/plan.md`

### What changed
- Documented that `OPTIMIZE_ROUTE_API_KEY` is currently not set in production.
- Documented that production requests therefore do not send or require the `x-optimize-route-key` header.
- Kept the optional backend API-key feature documented as available, but clarified that it is not part of the current production deployment posture.

### Why
- The current frontend calls the backend directly from browser code.
- In that architecture, a browser-sent optimize-route API key would not be a meaningful secret, so production intentionally leaves it unset for now.

### Verification
- Documentation update only.

---

## 43) Remove dvnp19 from CODEOWNERS

### Files updated
- `.github/CODEOWNERS`

### What changed
- Removed `@dvnp19` from all ownership rules in `.github/CODEOWNERS`.
- Kept the existing ownership scope lines while retaining only `@dnp99` in each rule.

### Why
- Ownership and review assignment needed to stop including `dvnp19`.

### Verification
- Verified `.github/CODEOWNERS` contains no `dvnp19` references.

---

## 44) Frontend Tests Centralized Under src/tests

### Files added
- `frontend/src/tests/apiBaseUrl.test.ts`
- `frontend/src/tests/routePlanner/routePlannerUtils.test.ts`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`
- `frontend/src/tests/routePlanner/useTheme.test.ts`
- `frontend/src/tests/routePlanner/useDestinationAddresses.test.ts`
- `frontend/src/tests/routePlanner/useRouteOptimization.test.ts`

### Files deleted
- `frontend/src/components/apiBaseUrl.test.ts`
- `frontend/src/components/routePlanner/routePlannerUtils.test.ts`
- `frontend/src/components/routePlanner/routePlannerService.test.ts`
- `frontend/src/components/routePlanner/useTheme.test.ts`
- `frontend/src/components/routePlanner/useDestinationAddresses.test.ts`
- `frontend/src/components/routePlanner/useRouteOptimization.test.ts`

### Files updated
- `plan.md`
- `plans/change-log.md`

### What changed
- Moved all frontend `*.test.ts` files out of `src/components/**` into a single centralized `src/tests/` folder.
- Kept logical grouping by using a `src/tests/routePlanner/` subfolder for route-planner-related tests.
- Updated import paths in moved tests to point to component/hook/service modules from their new location.

### Why
- Frontend test files were requested to be centralized in one tests folder.
- The new structure keeps tests easier to discover and enforces a consistent testing layout.

### Verification
- Test discovery:
  - `frontend/src/**/*.test.ts` now resolves only under `src/tests/` ✅
- Frontend quality/build:
  - `npm run test:coverage` ✅
  - `npm run lint` ✅
  - `npm run build` ✅
- Coverage retained after migration:
  - **97.61% statements / 93.22% branches / 100% functions / 97.60% lines** ✅

---

## 45) Address-Autocomplete Modular Refactor + Shared API Contracts

### Files added
- `shared/contracts/common.ts`
- `shared/contracts/optimizeRoute.ts`
- `shared/contracts/addressAutocomplete.ts`
- `shared/contracts/index.ts`
- `backend/src/app/api/address-autocomplete/constants.ts`
- `backend/src/app/api/address-autocomplete/validation.ts`
- `backend/src/app/api/address-autocomplete/cacheAndRateLimit.ts`
- `backend/src/app/api/address-autocomplete/googlePlacesClient.ts`
- `backend/src/app/api/address-autocomplete/addressAutocompleteService.ts`

### Files updated
- `backend/src/app/api/address-autocomplete/route.ts`
- `backend/src/app/api/optimize-route/route.ts`
- `backend/src/app/api/optimize-route/types.ts`
- `backend/src/app/api/optimize-route/route.test.ts`
- `backend/next.config.ts`
- `backend/tsconfig.json`
- `frontend/src/components/AddressAutocompleteInput.tsx`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/components/types.ts`
- `frontend/vite.config.js`
- `plan.md`
- `plans/plan.md`

### What changed
- Split `backend/src/app/api/address-autocomplete/route.ts` into a thin route adapter backed by focused modules:
  - constants (`constants.ts`)
  - query validation (`validation.ts`)
  - cache + rate limiting + client key resolution (`cacheAndRateLimit.ts`)
  - Google Places client/payload mapping (`googlePlacesClient.ts`)
  - orchestration service (`addressAutocompleteService.ts`)
- Added shared FE/BE API contract module under `shared/contracts` with runtime parse/guard helpers for:
  - common API error payloads
  - optimize-route request/response shapes
  - address-autocomplete response/suggestion shapes
- Updated frontend to consume shared contract helpers:
  - `routePlannerService.ts` now uses shared optimize-route response parsing and shared error extraction
  - `AddressAutocompleteInput.tsx` now uses shared autocomplete response parsing and shared error extraction
- Updated frontend component contract types (`types.ts`) to re-export shared API contract types.
- Added backend optimize-route response-shape guard before serialization to keep runtime response contracts explicit.
- Updated backend Next config to allow shared external-dir imports and frontend Vite dev server FS allow-list for shared folder usage.

### Why
- Address-autocomplete route had become a large multi-responsibility file and needed the same modularity pattern as optimize-route.
- Shared runtime contracts reduce FE/BE schema drift and keep response validation logic consistent across both apps.

### Verification
- Backend:
  - `npm run test:coverage` ✅
  - Result: **100% statements / 100% branches / 100% functions / 100% lines**
  - `npm run lint` ✅
  - `npm run build` ✅
- Frontend:
  - `npm run test:coverage` ✅
  - Result: **97.61% statements / 93.22% branches / 100% functions / 97.60% lines**
  - `npm run lint` ✅
  - `npm run build` ✅

---

## 46) Implementation Log Historical Order Cleanup

### Files updated
- `plan.md`
- `plans/plan.md`

### What changed
- Reordered the implementation log so older project history appears before newer entries.
- Renumbered all change sections into one monotonic sequence.
- Merged misplaced Ending Point follow-up notes back into the Ending Point section.
- Removed the duplicate legacy tail that had been appended to the bottom of the file.
- Restored unique section references so later cross-links are unambiguous.

### Why
- The implementation log had accumulated duplicated and out-of-order sections, which made the history difficult to read and made section references unreliable.

### Verification
- Verified `plans/plan.md` now runs in order from `## 1)` through `## 46)` with no duplicate section numbers.

---

## 47) Remove Google Routes Phase 1 Plan Document

### Files deleted
- `plans/google-routes-phase-1-plan.md`

### Files updated
- `plan.md`
- `plans/plan.md`

### What changed
- Removed the obsolete Phase 1 Google Routes planning document from `plans/`.
 - Updated `plans/change-log.md` planning document references to remove the stale “active plan” pointer.
- Updated the root `plan.md` index to reflect current planning documents.

### Why
- Google Routes Phase 1 is already implemented; keeping the Phase 1 plan referenced as active was stale and confusing.

### Verification
 - Verified `plans/google-routes-phase-1-plan.md` no longer exists.
 - Verified the planning document lists were updated in `plan.md` and `plans/change-log.md`.

---

## 48) Rename Change Log File

### Files renamed
- `plans/plan.md` -> `plans/change-log.md`

### Files updated
- `plan.md`
- `plans/change-log.md`

### What changed
- Renamed the implementation log file to `plans/change-log.md` to make its role obvious.
- Added a short note near the top of the change log explaining the rename.

### Why
- The previous name `plans/plan.md` was ambiguous and easy to confuse with an active planning document.

### Verification
- Verified `plans/change-log.md` exists and contains the prior change log content.
- Verified `plans/plan.md` no longer exists.

---

## 49) Multi-Visit Windows + Flexible Planning-Time Windows

### Commit
- `620ad20` - `feat(route-planner): support multi-visit windows and flexible planning-time windows`

### Files updated
- `backend/drizzle/0003_unusual_midnight.sql`
- `backend/drizzle/meta/0003_snapshot.json`
- `backend/drizzle/meta/_journal.json`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `backend/src/app/api/optimize-route/v2/validation.test.ts`
- `backend/src/app/api/optimize-route/v2/validation.ts`
- `backend/src/db/schema.ts`
- `backend/src/lib/patients/patientDto.test.ts`
- `backend/src/lib/patients/patientDto.ts`
- `backend/src/lib/patients/patientRepository.test.ts`
- `backend/src/lib/patients/patientRepository.ts`
- `backend/src/lib/patients/patientValidation.test.ts`
- `backend/src/lib/patients/patientValidation.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/patients/PatientFormModal.tsx`
- `frontend/src/components/patients/PatientsPage.tsx`
- `frontend/src/components/patients/patientForm.ts`
- `frontend/src/tests/integration/patientsRoutePlanner.integration.test.tsx`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
- `shared/contracts/patients.ts`

### What changed
- Added support for multiple persisted visit windows per patient.
- Allowed flexible patients to have no persisted preferred windows.
- Updated patient validation/repository/DTO flow for empty `visitWindows` (flexible case).
- Added planner-time window input for flexible patients without preferred windows.
- Added overlap/time validation to prevent invalid planning input.
- Added migration to create/populate `patient_visit_windows`.

### Verification
- Backend: `npm run test`, `npm run lint`, `npm run build` ✅
- Frontend: `npm run test`, `npm run lint`, `npm run build` ✅

---

## 50) Close V2 Window-First Planning Gaps

### Commit
- `6c8098e` - `feat(route-planner): close remaining v2 window-first planning gaps`

### Files updated
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/patients/PatientsTable.tsx`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`

### What changed
- Updated v2 ordering to prioritize window start, then distance tie-break from current location.
- Added per-window include/exclude controls in planner (instead of patient-only inclusion).
- Added optional persistence for planner-entered windows back to patient records.
- Updated Patients table type pill to reflect window-level state (`fixed` / `flexible` / `mixed`).

### Verification
- Backend targeted/full tests + lint + build ✅
- Frontend targeted/full tests + lint + build ✅
- Local migration execution: `npm run db:migrate` ✅

---

## 51) System Theme Default + Patient Name Capitalization

### Commit
- `937dfbf` - `feat(frontend): use system theme default and capitalize patient names`

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/patients/patientForm.ts`
- `frontend/src/components/patients/patientName.ts`
- `frontend/src/components/routePlanner/useTheme.ts`
- `frontend/src/tests/patients/PatientsPage.test.tsx`
- `frontend/src/tests/routePlanner/useTheme.test.ts`

### What changed
- Removed forced default dark mode; default theme now follows `prefers-color-scheme`.
- Added system-theme listener behavior when no explicit user preference exists.
- Added migration guard so old auto-saved theme values are ignored unless marked as manual.
- Standardized UI patient-name rendering to capitalize first/last names.

### Verification
- Frontend: targeted tests + `npm run lint` + `npm run build` ✅

---

## 52) Coverage Increase Pass (Frontend + Backend)

### Commit
- `ec83780` - `test: increase backend and frontend coverage`

### Files updated
- `backend/src/app/api/auth/requestGuards.test.ts`
- `backend/src/app/api/optimize-route/geocoding.test.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
- `backend/src/app/api/optimize-route/v2/route.test.ts`
- `backend/src/app/api/optimize-route/v2/validation.test.ts`
- `backend/src/lib/auth/jwt.test.ts`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`
- `frontend/src/tests/routePlanner/usePatientSearch.test.ts`

### What changed
- Added focused branch-coverage tests across auth guards, JWT validation, geocoding fallbacks, and v2 route/validation/ordering paths.
- Added frontend tests for route planner service edge branches and patient-search hook behavior.

### Coverage result
- Frontend branch coverage improved from `79.2%` to `83.2%` (passes frontend threshold).
- Backend branch coverage improved from `81.45%` to `84.99%` (improved but still below backend `90%` threshold).

### Verification
- Frontend: `npm run test:coverage` ✅
- Backend: `npm run test:coverage` ✅ (coverage improved), threshold still failing on branches by policy.

---

## 53) Planner Window Editing + Mobile UX + Patient Form Flow Refinements

### Commits
- `92f0e1d` - `feat(frontend): add editable planning windows and enforce light mode`
- `c8b082e` - `feat(frontend): improve mobile layout and patient list actions`
- `3f97d02` - `feat(frontend): refine patient form flow and planner controls`

### Files updated
- `frontend/src/App.jsx`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/patients/PatientFormModal.tsx`
- `frontend/src/components/patients/PatientsPage.tsx`
- `frontend/src/components/patients/PatientsTable.tsx`
- `frontend/src/components/patients/patientForm.ts`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/components/responsiveStyles.ts`
- `frontend/src/main.jsx`
- `frontend/src/tests/appRoutes.test.tsx`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`

### What changed
- Removed theme-toggle behavior and standardized the app shell to light-mode presentation.
- Updated header navigation/layout:
  - tab cards moved into a dedicated row with tighter responsive spacing,
  - logout moved behind an icon-triggered menu,
  - workspace subtitle now renders from capitalized nurse display name.
- Improved patients-list mobile UX:
  - icon actions for edit/delete,
  - refined card hierarchy and spacing (name/action alignment, type pill placement, reduced vertical gaps),
  - improved tab typography and mobile treatment.
- Expanded route-planner controls:
  - explicit optimize endpoint validation hint when no ending point is selected,
  - row-level overlap highlighting and conflict messaging tied to included visit windows,
  - retained overlap-blocking behavior until conflicts are resolved.
- Refined patient form modal flow:
  - icon-only close control,
  - required badges on first/last name,
  - field order aligned to `name -> address -> type -> windows`,
  - flexible type supports optional windows added only through `Add window`,
  - persisted multi-window editing remains supported.
- Updated routing/planner tests and service tests to cover these UI and validation behavior changes.

### Verification
- Frontend:
  - `npm run lint` ✅
  - `npm test` ✅

---

## 54) Visit Duration Rollout + Patient Table Window Layout Refinements

### Files updated
- `backend/drizzle.config.ts`
- `frontend/src/components/patients/PatientsTable.tsx`

### What changed
- Updated Drizzle config to explicitly load `.env.local` / `.env` before reading `DATABASE_URL`.
  - This resolves local migration failures where `drizzle-kit` did not auto-load env files (`url: ''`).
- Refined patient table rendering for preferred windows and type pills:
  - Removed standalone `Type` table column.
  - Moved type display into preferred-window content.
  - Added per-window list rendering (one line per time window).
  - Applied separate mobile/desktop placement behavior:
    - Desktop: type pill above time windows.
    - Mobile: type pill below time windows.
  - Mobile card layout updated to keep `Time windows` and `Visit duration` side-by-side, with `Address` above.
  - Adjusted desktop column widths to allocate more space to address/window columns and reduce `Duration`/`Actions` widths.
  - Prevented pill stretching in grid layout (`w-fit` / `justify-self-start`).

### Verification
- Backend:
  - `npm run db:migrate` ✅
  - `npm run lint` ✅
- Frontend:
  - `npm run lint` ✅
  - targeted tests for patients page + integration path ✅

---

## 55) V2 Rolling Scheduler: Overlap Support + Duration-Aware Next-Stop Selection

### Files updated
- `backend/src/app/api/optimize-route/v2/validation.ts`
- `backend/src/app/api/optimize-route/v2/validation.test.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`

### What changed
- Removed v2 backend validation that rejected overlapping visit windows.
- Replaced the v2 greedy window-start ordering with a rolling selector that reevaluates every remaining visit after each stop using:
  - estimated travel time/distance from current location,
  - projected arrival/service start/service end,
  - wait time and lateness,
  - duration-aware slack (`windowEnd - projectedServiceEnd`),
  - projected downstream impact on remaining fixed windows (count/seconds late).
- Kept fixed visits in-route when late; lateness remains visible through `lateBySeconds` and `fixedWindowViolations`.
- Updated v2 service tests for the new behavior:
  - urgent windows first,
  - distance tie-break when urgency is equivalent,
  - duration-aware prioritization.
- Removed frontend overlap-blocking behavior so the planner can submit overlapping windows to v2.
- Updated route planner patient-selection test to confirm overlapping windows can still be optimized.
- Updated v2 algorithm version to `v2.2.0-window-distance-duration`.

### Verification
- Backend:
  - `npm test -- src/app/api/optimize-route/v2/validation.test.ts src/app/api/optimize-route/v2/optimizeRouteService.test.ts` ✅
  - `npm run lint` ✅
- Frontend:
  - `npm test -- src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅

---

## 56) V2 Scheduler Tuning: Availability-First Tie-Break Refinement

### Files updated
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`

### What changed
- Tuned v2 candidate ranking so, after lateness-risk checks, it now prefers:
  - earlier achievable `serviceStartSeconds`,
  - lower waiting time,
  - then lower travel time,
  - then tighter slack/window tie-breaks.
- This reduces unnecessary long idle waits for far-future windows when a feasible earlier-start visit is available.
- Bumped v2 algorithm version to `v2.2.1-window-distance-duration`.
- Updated tests to reflect the tuned ordering semantics.

### Verification
- Backend:
  - `npm test -- src/app/api/optimize-route/v2/optimizeRouteService.test.ts src/app/api/optimize-route/v2/validation.test.ts src/app/api/optimize-route/v2/route.test.ts` ✅
  - `npm run lint` ✅

---

## 57) V2 Anti-Idle Gap Filling for Fixed-Window Anchors

### Files updated
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`

### What changed
- Added a gap-filling rule to v2 selection:
  - when the best candidate would cause a long idle wait, the scheduler now looks for a feasible filler visit that can be completed and still return to the anchor window on time.
- Added guardrails for filler selection:
  - do not increase anchor lateness,
  - bounded filler wait,
  - minimum useful gap utilization,
  - deterministic tie-break ordering.
- Added regression test for the real-world pattern:
  - two fixed windows at the same address with a large gap,
  - nearby flexible visit should be scheduled between them instead of waiting at the fixed address.
- Bumped algorithm version to `v2.2.2-window-distance-duration-gap-fill`.

### Verification
- Backend:
  - `npm test -- src/app/api/optimize-route/v2/optimizeRouteService.test.ts src/app/api/optimize-route/v2/route.test.ts src/app/api/optimize-route/v2/validation.test.ts` ✅
  - `npm run lint` ✅

---

## 58) Route Planner: Auto Departure Baseline + Leave-By Suggestion

### Files updated
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`

### What changed
- Reverted manual departure-time input from the route planner form.
- Removed the implicit "depart now" default for optimize-route requests.
- When no departure time is supplied, the planner now auto-anchors departure to planning-date midnight in the selected timezone.
- Added a UI leave-by recommendation:
  - computed from the first planned visit start and first leg travel time from the starting point.
- Added/updated test coverage for:
  - automatic departure baseline generation,
  - leave-by suggestion rendering.

### Verification
- Frontend:
  - `npm test -- src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx src/tests/routePlanner/routePlannerService.test.ts` ✅
  - `npm run lint` ✅

---

## 59) V2 Backend Dynamic Departure From Earliest First Stop

### Files updated
- `shared/contracts/optimizeRouteV2.ts`
- `backend/src/app/api/optimize-route/v2/validation.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.ts`
- `backend/src/app/api/optimize-route/v2/validation.test.ts`
- `backend/src/app/api/optimize-route/v2/optimizeRouteService.test.ts`
- `backend/src/app/api/optimize-route/v2/route.test.ts`
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`

### What changed
- Made `start.departureTime` optional in v2 request contract and backend validation.
- Added backend departure auto-resolution when `start.departureTime` is omitted:
  - select a first-stop anchor using earliest window start (tie-break: fixed over flexible, then closer to start),
  - compute start-to-anchor travel duration,
  - set departure to `anchor.windowStart - travel - 10 minutes`, clamped to day start.
- Applied computed departure throughout timeline generation and response payload.
- Bumped algorithm version to `v2.2.3-dynamic-departure-buffer`.
- Removed frontend-side departure baseline defaulting so UI does not need to pass departure time.

### Verification
- Backend:
  - `npm test -- src/app/api/optimize-route/v2/optimizeRouteService.test.ts src/app/api/optimize-route/v2/validation.test.ts src/app/api/optimize-route/v2/route.test.ts` ✅
  - `npm run lint` ✅
- Frontend:
  - `npm test -- src/tests/routePlanner/routePlannerService.test.ts` ✅
  - `npm run lint` ✅

---

## 60) Frontend Route Planner: Never Send `start.departureTime`

### Files updated
- `frontend/src/components/routePlanner/routePlannerService.ts`
- `frontend/src/components/routePlanner/useRouteOptimization.ts`
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`

### What changed
- Removed frontend request wiring for `departureTime` entirely.
- `requestOptimizedRoute` no longer accepts or validates `departureTime` input.
- Route planner payload now always sends:
  - `planningDate`
  - `timezone`
  - `start.address` (+ optional `start.googlePlaceId`)
  - without `start.departureTime`
- Updated service tests to assert `start.departureTime` is omitted.

### Verification
- Frontend:
  - `npm test -- src/tests/routePlanner/routePlannerService.test.ts src/tests/routePlanner/useRouteOptimization.test.ts src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅

---

## 61) V2 Validation + Route Summary UX Refresh

### Files updated
- `backend/src/app/api/optimize-route/v2/validation.ts`
- `backend/src/app/api/optimize-route/v2/validation.test.ts`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx`

### What changed
- Updated fixed-window validation messaging in v2 to show the patient name instead of indexed payload paths:
  - from `visits[2] ...`
  - to `<patientName> fixed window must be at least serviceDurationMinutes long.`
- Updated route summary task rows to include visit duration:
  - `Patient: Name • HH:MM - HH:MM • fixed/flexible • <duration>`
- Moved ending-point labeling to the stop header line:
  - `<address> • Ending point`

### Verification
- Backend:
  - `npm test -- src/app/api/optimize-route/v2/validation.test.ts` ✅
  - `npm run lint` ✅
- Frontend:
  - `npm test -- src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅

---

## 62) Map Marker Labels + Overlap Visibility

### Files updated
- `frontend/src/components/RouteMap.tsx`
- `frontend/src/tests/routePlanner/RouteMap.helpers.test.ts`

### What changed
- Replaced numeric stop markers with patient-initial marker labels.
- For multi-visit stops, marker text now aggregates initials:
  - same patient twice: `YR+YR`
  - different patients: `YR+XR`
- Added label capping for very dense stops:
  - example: `YR+XR+2`
- Added dynamic marker sizing + centered anchoring for longer labels.
- Added overlap offset clustering so markers at the same or near-identical coordinates no longer collapse visually.
- Added focused unit coverage for:
  - initials generation,
  - marker text aggregation,
  - icon metric sizing/anchoring,
  - overlap offset behavior.

### Verification
- Frontend:
  - `npm test -- src/tests/routePlanner/RouteMap.helpers.test.ts src/tests/routePlanner/RoutePlanner.patientSelection.test.tsx` ✅
  - `npm run lint` ✅

---

## 63) Frontend Coverage Expansion For Route Planner Service

### Files updated
- `frontend/src/tests/routePlanner/routePlannerService.test.ts`
- `frontend/coverage/coverage-summary.json`

### What changed
- Added test coverage for previously under-covered `routePlannerService` branches:
  - timezone fallback to `UTC` when browser timezone resolution is unavailable,
  - planning-date formatting failure path,
  - visit-window sorting tie-breakers (`start`, then `end`, then `visitTimeType`).
- Hardened Intl mocking in tests to avoid constructor-mock leakage between cases.

### Verification
- Frontend:
  - `npm test -- src/tests/routePlanner/routePlannerService.test.ts` ✅
  - `npm run lint` ✅
  - `npm run test:coverage` ✅
- Coverage snapshot:
  - overall branches: `80.76% -> 85.57%`
  - `routePlannerService.ts` branches: `79.31% -> 87.93%`

---

## 64) Root README Refresh + CAREFLOW Branding

### Files updated
- `README.md`

### What changed
- Updated root documentation to current app state and naming.
- Renamed the project heading to `CAREFLOW`.
- Refreshed API and local-run sections to emphasize v2 route planning flow:
  - `POST /api/optimize-route/v2`
  - optional backend-derived departure behavior when frontend omits `start.departureTime`.
- Kept frontend API-base configuration order and runtime override behavior in docs.
