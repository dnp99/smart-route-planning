# Route Planner Redesign (phased)

## Context

Redesign the Smart Route Planner to match the Claude Design `Route Planner Redesign` (desktop + mobile screenshots). The design's thesis (from its own annotation):

- **Start & end float as form fields that bookend the trip** (green start → "N stops" rail → flag end).
- **Numbered nodes + a connecting rail** make the route sequence legible at a glance.
- **"Scheduled" pills sit quietly on each window**, not repeated as full buttons.
- **Result stats live directly under the route**, not in a separate scattered block.

Desktop is a two-column layout (client search/list on the left, route timeline on the right) inside a "Clients" card whose header holds the optimize controls. Mobile is a single-column scroll.

**Current implementation:** [RoutePlanner.tsx](frontend/src/features/route-planner/ui/RoutePlanner.tsx) composes three sections — `TripSetupSection`, `PatientSelectorSection`, `RouteResultSection` — via `useRoutePlannerController`. Mobile today is a **step-wizard** (`mobileSteps` / `activeMobileStep`), which the redesign replaces with a single scroll.

**Conventions (every phase):** styles in `responsiveStyles.ts` (no inline Tailwind beyond one-off positional); logic in `use*` hooks / `domain/` with `.tsx` kept view-only; reuse existing tokens/components where possible; lint + `npm run test` green before each commit; commit per phase.

## Approach

Build in **4 phases**, each shippable + verifiable + committed on its own. Before each phase I'll do a focused read of the exact component(s) it touches and confirm specifics, then build. Phases are ordered to minimize churn; the controller hook (`useRoutePlannerController`) is touched incrementally.

---

### Phase 1 — Trip setup bookend + optimize controls
- Rework `TripSetupSection` into the **bookend card**: `START` (green target) address → a "• N stops" rail → `END` (flag) address, with the **planning date** chip and an **Edit** affordance. Collapsed read view + edit mode.
- Relocate the objective selector into a **`Less driving / Finish sooner` segmented toggle** (maps to `optimizationObjective` distance/time) plus the **`Re-optimize Route`** button, in the route/clients controls header.
- New tokens for the bookend rail, start/end markers, segmented toggle (reuse `authSegmentedControl` family), date chip.

### Phase 2 — Client list (left column)
- Rework `PatientSelectorSection` into the **search + client-card list**: avatar initials (reuse `getPatientInitials`), name, address, and an `In route` badge (selected) vs `+` add button. Two-column shell (left) on desktop.
- Reuse the patient search hook + selected-destinations state already in the controller; this is a presentational rework, not new selection logic.

### Phase 3 — Route timeline + stats (right column) — the headline
- Rework `RouteResultSection` / [OptimizedRouteResult.tsx](frontend/src/features/route-planner/ui/OptimizedRouteResult.tsx) + [OptimizedStopList.tsx](frontend/src/features/route-planner/ui/OptimizedStopList.tsx) into a **vertical numbered timeline**: `START` node → numbered stop nodes on a connecting rail → `END` node. Each stop is a card; multi-window clients are **collapsible** ("N windows"), each window a row with a quiet **"Scheduled"/late** pill (not a full button). Preserve manual reorder + "Recalculate times" behavior under the new visuals.
- Move **result stats directly under the route**: on-time banner ("All N visits on time · Finishes around …"), **Distance**, **Scheduled stops**, **Leave by**. Reuse existing metrics; restyle into the compact card row + banner.

### Phase 4 — Mobile single-column layout
- Replace the step-wizard (`mobileSteps`/`activeMobileStep` in `useRoutePlannerController` + the `mobileStepNav` in `RoutePlanner.tsx`) with the **single-column scroll**: trip card → optimize toggle → `Re-optimize` → on-time banner → timeline. ⚠️ Decision to confirm at this phase: fully remove the wizard vs. keep it as a fallback. (Leaning: remove, per the mock.)

---

## Per-phase verification
- Read the exact component(s) first; confirm specifics (esp. anything ambiguous in the mock).
- Update/extend the relevant test(s) (`RouteResultSection.test.tsx`, `RoutePlanner.patientSelection.test.tsx`, `OptimizedRouteResult.test.tsx`, `OptimizedStopList.test.tsx`, etc.) — these assert structure, so expect to adjust them.
- `npm run lint` + `npm run test` from `frontend/` green; commit the phase.
- Live check on `:5173` HMR (auth-walled, so the user eyeballs; the visual-verification gap noted on prior UI work applies here too).

## Out of scope (note for later)
- Map (`RouteMap`) interactions — the redesign screenshots don't feature the map; keep current behavior unless a later mock covers it.
- Backend/contract changes — this is a pure frontend re-skin over the existing optimize flow.
