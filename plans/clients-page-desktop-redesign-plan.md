# Clients page + nav bar redesign — DESKTOP

## Status
PLANNING — desktop only. Mobile is **deferred** pending a mobile Figma (keep current
mobile cards working in the meantime). Builds on the shipped Active/Idle/Archived
lifecycle ([plans/completed/clients-lifecycle-states-plan.md](completed/clients-lifecycle-states-plan.md)).

## Source of truth (Claude Design handoff)
`~/Downloads/clarifying-project-details/project/`
- **`Clients Tabs & Bulk Archive.dc.html`** — the chosen, polished desktop design (primary).
- `Clients Redesign.dc.html` — broader exploration (table vs card grid, mobile, modal).
- Designer note: "stays 100% inside the existing design system" (slate canvas, blue brand,
  pill colors, 8pt grid). This is a **restyle**, not a new system.

## Scope
- ✅ Desktop nav bar merge.
- ✅ Desktop Clients page (tabs + counts, polished table, header bulk toolbar, etc.).
- ✅ Backend counts endpoint.
- ⏸ Mobile — deferred (mobile Figma incoming).
- ❌ Add/Edit modal redesign — out for now.

## Decisions locked
1. Archived = **retain-but-hide** (no hard delete). The mock's "permanently removed after
   7 days" copy is wrong → keep the accurate copy.
2. Tab counts shown as **parens**: `Active (5)`.
3. Keep **`max-w-7xl`** (design-system rule) — the mock's 1560px is just its canvas.
4. All new styling goes in **`responsiveStyles.ts`** tokens (no inline Tailwind in components),
   reusing existing pill/color tokens.

## Sub-decisions surfaced by the mock (confirm during build, defaults below)
- **A. Idle per-row actions = Edit only** (no per-row trash; archive via checkbox + bulk bar).
  Mock: `showDelete = tab==='active'`. → Default: follow the mock; Idle archives via selection.
- **B. Privacy reminder = always visible** at the card bottom (mock) — drop the `i` toggle. → follow mock.
- **C. Stats row (Total/Fixed/Flexible/Avg) — KEEP** (Active tab only, as today). The Figma
  omitted it but it stays. Place it inside the new card, after the tabs/helper and before the
  controls row.
- **D. Active per-row = Edit + Archive (trash)** with the restorable confirm — matches current.

---

## Backend

### `backend/src/lib/patients/patientRepository.ts`
- Add `countPatientsByStateForNurse(nurseId)` → `{ active, idle, archived }`, reusing
  `activeCondition` / `idleCondition` (already extracted) and the `archived_at >= now()-7d`
  window. Three `count(*)::int` queries (or one query with conditional aggregates).

### Route — `backend/src/app/api/patients/counts/route.ts` (new)
- `GET /api/patients/counts` → `{ active, idle, archived }`. CORS + `requireAuth` like the
  existing patients routes. Light audit log (`patients.counts`).

### Tests
- `patientRepository.test.ts`: a `countPatientsByStateForNurse` test (mock 3 selects).
- New `counts/route.test.ts` (auth + shape), mirroring `route.test.ts`.

---

## Frontend — Nav bar (merge header + tabs into one bar)

Mock nav: single 72px bar — `[logo tile + ROUTEFY]` left · `Home / Clients / Route Planner`
(icon + label, gap 32, active = blue text + 2px underline) center · `MS` avatar right.

Current: `AppHeader` (logo + account menu/avatar, scroll-shrink) **and** a separate `tabStrip`
with `AppTabs` (NavLinks) stacked below it (see `App.jsx`).

- **`App.jsx`** — collapse the two rows: render the nav links **inside** the header bar instead of
  a separate `tabStrip` below. Keep `stickyHeaderShell`.
- **`AppHeader.tsx`** — add the centered nav (reuse `AppTabs` content or inline the 3 NavLinks)
  between the brand and the account avatar. Preserve: account menu (`useClickOutside`),
  scroll-shrink (`useScrollShrink`), logged-out centered variant, account initials.
- **`AppTabs.jsx`** — keep the NavLink + active-route logic (`aria-current`); restyle to the mock
  (icon 17px + label 14.5px; inactive `#64748B`/500, active `#2563EB`/600 + 2px underline). Its
  tests (`AppTabs.test.jsx`) assert links/`aria-current` — keep those passing.
- Tokens: `navBar`, `navBarInner`, `navItem`, `navItemActive`, `navItemInactive`, `navUnderline`,
  brand tile/avatar tokens. Map mock colors to existing slate/blue tokens where they exist.
- Preserve responsive behavior for now (mobile nav unchanged until the mobile Figma).

---

## Frontend — Clients page (desktop)

Files: `features/patients/ui/PatientsPage.tsx`, `features/patients/ui/PatientsTable.tsx`,
`components/responsiveStyles.ts`, `features/patients/api/patientService.ts`.

### Layout — single card
Wrap tabs + helper + controls + table + privacy in ONE white card: `bg-white border
border-slate-200 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,.06)] p-8` (mock: radius 24,
pad 32/34/36). Page bg already `from-slate-50 to-white` (keep).

### Tabs (with counts)
- `Active (5) · Idle (3) · Archived (2)` — counts in parens, from the new counts endpoint
  (fetched on load + after archive/restore). Active tab: `text-blue-600 font-semibold` + 2px
  underline; count `text-blue-300`. Inactive: `text-slate-500 font-medium`; count `text-slate-300`.
- Replace the current text tab tokens; bottom border on the row.

### Helper text
- Idle: clock icon + "No visits scheduled in the last 30 days. Select any clients you no longer
  need and archive them to keep your active list clean."
- Archived: archive icon + **accurate** copy (current: "Archived clients stay here for 7 days.
  Restore one to move it back to Active." — keep; do NOT say "permanently removed").

### Controls row
- Search (flex-1, h-46, rounded-13, icon-left) + window-type segmented (All/Fixed/Flexible,
  hidden on Archived — already) + Add Client (blue, h-46, rounded-13, plus icon). Restyle to mock.

### Stats row (keep — Active tab only)
- Keep the Total/Fixed/Flexible/Avg cards (sub-decision C) on the Active tab, placed inside the
  card after the tabs/helper and before the controls. Hidden on Idle/Archived (as today).

### Table (`PatientsTable.tsx`, desktop)
Bordered rounded container (`border rounded-2xl overflow-hidden`).
- **Header row** (`bg-slate-50`, columns): `[select-all checkbox — Idle only]` · Name (blue
  uppercase + sort arrow) · Address · Window (+ filter icon) · Duration · Repeat · actions.
  Column widths per mock: Name 1.7 / Address 1.7 / Window 1.9 / Duration 100px / Repeat 80px /
  actions 120px.
- **Bulk header** (Idle + ≥1 selected) — the header row becomes `bg-amber-50`: select-all
  checkbox + "N clients selected" + divider + **Clear** + spacer + **Archive N clients** (amber
  button). This **replaces** the current separate above-table amber bar.
- **Rows**: avatar (36px) + bold name · 2-line address · Window = Fixed/Flexible pill + time +
  **"+N more"** link (multi-window) · Duration (clock + text) · Repeat (calendar + count badge,
  or muted icon) · actions per tab:
  - Active → Edit + Archive(trash, restorable confirm)
  - Idle → Edit + row checkbox (archive via bulk) — **no per-row trash** (sub-decision A)
  - Archived → Restore button
  - Selected row bg `#F5F9FF`.

### Privacy reminder
- Always-visible card at the bottom (shield icon + "Privacy Reminder" + text), per mock
  (sub-decision B) — remove the `i` toggle on this page.

### `patientService.ts`
- `fetchPatientCounts()` → `{ active, idle, archived }`.

### Tokens (`responsiveStyles.ts`)
Add: card wrap, tab + tab-count, helper row, table container/header/headerCell/row/cell,
bulk-header (amber), select-all/row checkbox, window "+N more" link, restore button, privacy
card. Reuse `visitTypePill*`, `clientAvatar`, existing button tokens where possible.

---

## Tests
- `PatientsPage.test.tsx` — tab counts render (mock `fetchPatientCounts`), select-all + header
  bulk archive, Idle has no per-row trash, stats row still renders on Active, privacy always-visible.
- `PatientsTable.test.tsx` (if present) / table-related assertions — new header/columns, select-all.
- `appRoutes` / nav tests — header now contains the nav; keep `AppTabs` link/`aria-current` tests.
- Backend — `countPatientsByStateForNurse` + counts route.
- No DB migration.

## Phasing (commit per phase)
1. ✅ **Backend counts** + `fetchPatientCounts` + tab counts wired into the tabs. (ea630b8)
2. ✅ **Nav bar merge** (header + tabs into one bar on desktop; mobile strip kept). (8d719fd)
3. ✅ **Desktop table restyle** — in-header amber bulk toolbar + select-all, Idle Edit-only,
   selected-row highlight, Idle helper, always-on privacy card. Stats row KEPT. (adc24cb)
4. ✅ **Mobile** (figma: `Clients Tabs & Bulk Archive - Mobile.dc.html`) — dropped the mobile
   title, Add moved beside search, idle card checkboxes + selected highlight, sticky bottom
   bulk-archive bar, idle cards Edit-only. Mobile nav strip kept; cards still expand in place.

## Verification per phase
- `npm run lint` + `npm run test` (frontend) green; backend `vitest run` green.
- Eyeball desktop at `max-w-7xl` in the Chromium preview (resize ~1280–1440) against the mock.
- Keep the design-system rules (tokens, pill colors, 8pt grid, `max-w-7xl`).
