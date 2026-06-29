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

## Status

_All work below is on `develop` and **pushed** (through commit `3d4472a`)._

- **Phase 1 — ✅ DONE** (`448a36b`) — trip-setup bookend.
- **Phase 2 — ✅ DONE** (`cfa27ea`) — client-card list.
- **Phase 3 — ✅ DONE** (`e3f72c0`, `2b81ced`) — result timeline rail (START → numbered nodes → END flag). Decision taken: **one node per stop** (preserves the same-address reorder fix); per-client-window grouping deferred. Stats kept in the existing "Dispatch Plan" block under the route header (not relocated).
- **Timeline header polish — ✅ DONE** (`067646f`) — Reset/Recalculate folded into the header; Save-as-image shown only in default (non-stale) mode.
- **Outside-click collapse — ✅ DONE** (`990dc66`) — trip card collapses on click-outside / Esc (desktop, when both points set).
- **Optimize-control icons — ✅ DONE** (`e006ecd`).
- **"Your Route" preview + search header — ✅ DONE** (`51eedde`).
- **Figma-match pass for the Clients / "Your Route" panel — ✅ DONE** (`3d4472a`) — stacked header, blue count badge, greyed collapsed title, borderless lists, gray Your-Route canvas + vertical separator, timeline node restyle (trip-style START/END at numbered-node size, thin ring outline, dark-blue rail), Scheduled pill restored + inline on single cards, pencil-icon edit.
- **Phase 4 — ✅ DONE** (`7f7d3dd`) — mobile single-column: wizard fully removed, `activeMobileStep` dropped from the draft (legacy field ignored), sticky bottom Optimize/Re-optimize bar, trip card collapsible on mobile (bookend, `b4865f5`). All four locked-in decisions met. Subsequent mobile polish (overflow fixes, "Your Route" pills/labels, full-width toggle, sticky-CTA iOS fix) layered on top.

> **Finding from Phase 1:** the `Less driving / Finish sooner` toggle **and** the `Optimize/Re-optimize Route` button already exist in the Clients card header ([PatientSelectorSection.tsx](frontend/src/features/route-planner/ui/PatientSelectorSection.tsx)) and already match the design's labels — so the "relocate optimize controls" work was a no-op. Phase 1 ended up being just the trip-setup bookend.

---

### Phase 1 — Trip setup bookend ✅ DONE
- Reworked the **desktop collapsed** view of `TripSetupSection` into the bookend: `TRIP SETUP` eyebrow + planning-date chip header, then `START` (green target marker) → dashed "• N stops" rail → `END` (blue flag marker) + `Edit`. Threaded `stopCount` (`destinationCount`) through the controller. Expanded edit view (two address inputs) unchanged.
- Matched the **planning-date chip** to the design (blue calendar icon, bold dark-blue date, more padding, auto width) — `DatePicker` is compact-only, used only here. Made the `END` label blue.
- New tokens: `tripBookendRow`, `trip{Start,End}Marker`, `trip{Start,End}Label`, `tripAddress{Primary,Secondary}`, `tripStopsPill`, `tripRailDashed`, `tripEditButton`.
- Note: the center rail + stops pill shows at `lg+`; below that it collapses to Start … End + Edit (avoids cramping). Optimize toggle/button already existed — not touched.

### Phase 2 — Client list (left column)
- Rework `PatientSelectorSection` into the **search + client-card list**: avatar initials (reuse `getPatientInitials`), name, address, and an `In route` badge (selected) vs `+` add button. Two-column shell (left) on desktop.
- Reuse the patient search hook + selected-destinations state already in the controller; this is a presentational rework, not new selection logic.

### Phase 3 — Route timeline + stats (right column) — the headline
- Rework `RouteResultSection` / [OptimizedRouteResult.tsx](frontend/src/features/route-planner/ui/OptimizedRouteResult.tsx) + [OptimizedStopList.tsx](frontend/src/features/route-planner/ui/OptimizedStopList.tsx) into a **vertical numbered timeline**: `START` node → numbered stop nodes on a connecting rail → `END` node. Each stop is a card; multi-window clients are **collapsible** ("N windows"), each window a row with a quiet **"Scheduled"/late** pill (not a full button). Preserve manual reorder + "Recalculate times" behavior under the new visuals.
- Move **result stats directly under the route**: on-time banner ("All N visits on time · Finishes around …"), **Distance**, **Scheduled stops**, **Leave by**. Reuse existing metrics; restyle into the compact card row + banner.

### Phase 4 — Mobile single-column layout — ✅ DONE

Replace the mobile 3-step wizard (Trip → Clients → Review) with a single scrollable column, keeping each section contained so it isn't an endless scroll.

**Decisions locked in:**
1. **Fully remove the wizard** (per the mock). One commit, easily revertible.
2. Mobile Optimize action = **sticky bottom CTA bar** (always reachable), replacing the per-step "Continue to…" footers.
3. **Full removal of `activeMobileStep`** from the persisted draft (the more thorough draft-cleanup option).
4. Trip card stays **collapsible** on mobile.

**How add-client still works (the concern raised):** the wizard only gated *which step is visible* — it never enabled adding. The search box + `+ Add` + results list (`+` / `In route` toggles) + the Your-Route list all live in the Clients card, which already collapses to one column on mobile (`patientSelectionGrid` is `grid-cols-1 md:grid-cols-2`). So on mobile: scroll to Clients → search → tap `+` → it's added and shows in Your Route below.

**Changes, file by file:**
- **`useRoutePlannerController.ts`** — set `isTripStepVisible` / `isPatientsStepVisible` / `isReviewStepVisible` to `true` (always render all sections); delete the `mobileSteps` array; stop returning `mobileSteps` / `activeMobileStep` / `setActiveMobileStep`.
- **`RoutePlanner.tsx`** — remove the `mobileStepNav` block. Sections already render stacked → natural single column.
- **`RouteResultSection.tsx`** — remove the "Continue to Clients →" / "Continue to Review →" sticky footers and the "Ready to optimize" review card. Replace with a single **sticky bottom Optimize/Re-optimize bar** (mobile only).
- **Draft cleanup** — `routePlannerDraft.ts` (drop `activeMobileStep` from the type + serialize/validate) and `useRoutePlannerDraftState.ts` (drop the state + reset). Keep **old saved drafts parsing** (ignore the now-stale field; don't necessarily bump version) so existing localStorage drafts don't break.

**Containment (avoid endless scroll):**
- Trip card collapses once start+end set (the bookend).
- Clients card's search-results + Your-Route lists keep their capped mobile scroll heights (`mobileSearchListMaxHeight` / `mobileSelectedListMaxHeight`) so each list scrolls internally.
- Result timeline renders below once optimized.

**Test impact:**
- `RouteResultSection.test.tsx` — ~4 wizard tests ("Continue to Clients →", "Continue to Review →", "Ready to optimize", mobile optimize) → rewrite for the single-column + sticky-CTA behavior.
- `routePlannerDraft.test.ts` — update for the removed `activeMobileStep` (valid-draft fixture + the invalid-value case).
- `RoutePlanner.patientSelection.test.tsx` — one fixture sets `activeMobileStep: "trip"`; drop it.

**Verification:** mobile-viewport screenshots — stacked flow, search+add works, sticky Optimize bar, lists scroll internally, collapsible trip card.

---

## Per-phase verification
- Read the exact component(s) first; confirm specifics (esp. anything ambiguous in the mock).
- Update/extend the relevant test(s) (`RouteResultSection.test.tsx`, `RoutePlanner.patientSelection.test.tsx`, `OptimizedRouteResult.test.tsx`, `OptimizedStopList.test.tsx`, etc.) — these assert structure, so expect to adjust them.
- `npm run lint` + `npm run test` from `frontend/` green; commit the phase.
- Live check on `:5173` HMR (auth-walled, so the user eyeballs; the visual-verification gap noted on prior UI work applies here too).

## Out of scope (note for later)
- Map (`RouteMap`) interactions — the redesign screenshots don't feature the map; keep current behavior unless a later mock covers it.
- Backend/contract changes — this is a pure frontend re-skin over the existing optimize flow.
