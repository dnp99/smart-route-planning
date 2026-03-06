# Implementation Plan & Change Log

This file documents all changes completed for the React frontend + Next.js backend route planner.

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
