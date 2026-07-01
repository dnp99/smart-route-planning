# Clients Page + Desktop Nav — Polish & Coherence Pass — IMPLEMENTED

## Context
Both surfaces had already been redesigned (see `clients-page-desktop-redesign-plan.md`) and the nav is the current "design 2a" left rail. This pass did not restructure them — it removed accumulated redundancies/inconsistencies and tightened density so the desktop experience reads as one coherent system. Constraints held throughout: `max-w-7xl`, all styling in `responsiveStyles.ts`, design-system tokens only, no structural rework.

## Phasing
1. ✅ **Phase 1 — Nav coherence (account + Settings)** (`b20a6bb`)
   - Collapsed three overlapping account/settings affordances into one Settings entry + one Logout entry.
   - `AppSidebar.jsx`: Settings row gets an active state while its modal is open (new `isSettingsActive` prop + `sidebarNavButtonActive` token mirroring the AppTabs sidebar-active look); account card menu is now `items="logoutOnly"`.
   - `App.jsx`: passes `isSettingsActive={isAccountSettingsOpen}`.
   - `AppHeader.tsx`: removed the redundant desktop top-bar avatar + orphaned divider; mobile keeps its full avatar menu.
   - Test: `frontend/src/tests/navigation/AppSidebar.test.tsx` (active-state + logout-only card).

2. ✅ **Phase 2 — Clients filters + stats** (`2d8c53b`)
   - Unified the All/Fixed/Flexible filter into a single segmented control at all breakpoints (reused `segmentedControl*` tokens); deleted the divergent mobile pill row and retired `clientFilterToggle/Option*/Pill*`.
   - Tightened `clientStatsStrip` — dropped the filled gray band for a light borderless summary line.
   - Files: `frontend/src/features/patients/ui/PatientsPage.tsx`, `responsiveStyles.ts`.

3. ✅ **Phase 3 — Clients table density / overflow** (`c49697a`)
   - `table-fixed` + Name (`line-clamp-2` + `min-w-0`) / Address (`truncate`) truncation with full text via `title`.
   - Fixed the real `+N more` popover clipping: it was cut off by the table card's `overflow-hidden`, so it's now portaled to `<body>` with fixed positioning from the trigger rect (right-anchors near the viewport edge; closes on scroll/resize/Escape/outside-click).
   - Denser desktop rows (`py-5 → py-3.5`, skeleton matched to avoid layout shift).
   - Files: `frontend/src/features/patients/ui/PatientsTable.tsx`; test `frontend/src/tests/patients/PatientsTable.test.tsx` (truncation titles + portaled popover open/close).

4. ❌ **Nav date pill + breadcrumb — REVERTED** (shipped `e29a0cf`, reverted `815f334`)
   - Attempted to fold the date into the sidebar "Today" card, drop the top-bar date pill, and replace the breadcrumb with a plain page label. Reverted at the user's request — the top bar read too sparse with both the date pill and (Phase 1) avatar gone.
   - Net: the top-bar date pill + `Home > …` breadcrumb + `topBarDatePill`/`topBarDivider` tokens remain as they were. The date/breadcrumb-vs-sidebar-"Today" overlap is still open for a future pass (needs a different resolution that keeps the top bar balanced).

## Verification
- `npm run lint` + `npm run test` from `frontend/` green after each phase (pre-commit hook enforces both; 236 tests at Phase 3).
- Manual (desktop, `localhost:5173`): Settings row highlights while its modal is open; account card menu shows Logout only; no desktop top-bar avatar; the client filter looks identical desktop/mobile; stats line reads lighter; long names/addresses truncate with hover title; `+N more` popover fully visible on last-row/right-edge cells; denser rows.

## Out of scope (still open)
- Date pill vs sidebar "Today" card overlap + breadcrumb duplication (Phase 4 approach was reverted; revisit with a top-bar layout that stays balanced).
- Structural options if desired later: stats → KPI cards, a right-side client detail panel, collapsible rail.
