# Clients Page — Summary Stats Row (desktop only)

## Context

The Clients page ([PatientsPage.tsx](frontend/src/features/patients/ui/PatientsPage.tsx)) currently jumps straight from the header ("Clients (48)") into the search bar and table. We want a row of four summary cards — **Total Clients · Fixed Window · Flexible · Avg Duration** — inserted **above the search bar**, matching the dashboard KPI look. Per request: **desktop only — hidden on mobile for now.**

The counts must stay consistent with the table's All/Fixed/Flexible tabs, which classify each client via `resolveVisitTypeLabel`.

**Convention (applies throughout):** keep `.tsx` files view/layout only — extract derivation/logic into hooks (`use*`) and reusable pure helpers into `domain/`. The component should just consume a hook's return value and render. Always extract reusable code rather than inline it.

## Scope / decisions

- **Placement:** between the page-error banner and the search/table `<div>` — i.e., after [PatientsPage.tsx:485](frontend/src/features/patients/ui/PatientsPage.tsx#L485), before the `<div>` at line 487.
- **Responsive:** `hidden md:grid` — 4 columns on desktop (≥768px), not rendered on mobile. (Mobile treatment deferred.)
- **Data source:** compute from the `patients` state array ([PatientsPage.tsx:53](frontend/src/features/patients/ui/PatientsPage.tsx#L53)) — the same list the header count and table use. So when a name/address search is active the cards reflect the filtered set (consistent with the header's `Clients (X of Y)`); with no search they show the full 48, matching the mockup.
- **Classifier reuse (correctness):** `resolveVisitTypeLabel` is currently **private** to [PatientsTable.tsx:122](frontend/src/features/patients/ui/PatientsTable.tsx#L122) and returns `"fixed" | "flexible" | "mixed"`. Extract it to a shared module so the cards and the table tabs use one source of truth (any "mixed" clients count toward neither Fixed nor Flexible — exactly as the tabs filter today, so `Fixed + Flexible` may be ≤ Total).
- **Colors (design system §6/§13):** Fixed value blue, Flexible value emerald, Total + Avg neutral slate — matches the mockup and the blue=fixed / green=flexible convention.

## Implementation

### 1. Extract the visit-type classifier (reuse, no logic change)
- New file `src/features/patients/domain/visitType.ts` exporting `resolveVisitTypeLabel(patient: Patient): "fixed" | "flexible" | "mixed"` — move the existing function body verbatim from [PatientsTable.tsx:122](frontend/src/features/patients/ui/PatientsTable.tsx#L122) (the `domain/` folder already holds shared patient logic like `patientForm.ts`, `patientName.ts`).
- Update `PatientsTable.tsx` to import it and delete the local copy. No behavior change.

### 2. Style tokens (all styles in responsiveStyles.ts — mandatory)
Add to [responsiveStyles.ts](frontend/src/components/responsiveStyles.ts), reusing the existing dashboard KPI look:
- `clientStatsRow: "mb-6 hidden grid-cols-4 gap-3 md:grid"` — desktop-only 4-col grid.
- Reuse `dashboardKpiCard` for each card, `dashboardKpiLabel` for the uppercase label.
- `clientStatValue: "m-0 mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"` (neutral; or reuse `dashboardKpiValue`).
- `clientStatValueFixed: "… text-blue-600 dark:text-blue-300"` and `clientStatValueFlexible: "… text-emerald-600 dark:text-emerald-300"` (same sizing, colored).
- `clientStatValueSuffix: "ml-1 text-sm font-normal text-slate-500 dark:text-slate-400"` — for the " min" after Avg Duration.

### 3. Derivation logic → a hook (keep the .tsx view-only)
Per the convention, the stats math does **not** live inline in `PatientsPage.tsx`. Split it:

- **Pure helper** in `src/features/patients/domain/clientStats.ts`:
  ```ts
  export type ClientStats = { total: number; fixed: number; flexible: number; avgDuration: number };
  export const computeClientStats = (patients: Patient[]): ClientStats => {
    const total = patients.length;
    const fixed = patients.filter((p) => resolveVisitTypeLabel(p) === "fixed").length;
    const flexible = patients.filter((p) => resolveVisitTypeLabel(p) === "flexible").length;
    const avgDuration = total
      ? Math.round(patients.reduce((sum, p) => sum + p.visitDurationMinutes, 0) / total)
      : 0;
    return { total, fixed, flexible, avgDuration };
  };
  ```
  (`visitDurationMinutes` is the per-client duration field on `Patient`; reuses the extracted `resolveVisitTypeLabel`.)
- **Hook** in `src/features/patients/hooks/useClientStats.ts` (new `hooks/` folder, mirroring `features/route-planner/hooks/`):
  ```ts
  export const useClientStats = (patients: Patient[]): ClientStats =>
    useMemo(() => computeClientStats(patients), [patients]);
  ```
- In `PatientsPage.tsx`, just: `const clientStats = useClientStats(patients);` — no math in the component.

### 4. Render the row
Insert after the `pageError` block (line 485), before the search `<div>` (line 487):
```jsx
<div className={responsiveStyles.clientStatsRow}>
  {/* Total Clients */}        — value: clientStats.total          (neutral)
  {/* Fixed Window */}         — value: clientStats.fixed           (clientStatValueFixed)
  {/* Flexible */}             — value: clientStats.flexible        (clientStatValueFlexible)
  {/* Avg Duration */}         — value: clientStats.avgDuration + <span suffix>min</span>
</div>
```
Each card = `dashboardKpiCard` > `dashboardKpiLabel` (e.g., "TOTAL CLIENTS") + value paragraph. Labels uppercase to match the mockup (the token already uppercases).

## Tests

Test the extracted logic directly (cheap, exhaustive) and the page render thinly:
- **`domain/clientStats.test.ts`** — `computeClientStats` over a mix incl. a "mixed" (multi-window) client and the empty list: assert total/fixed/flexible counts, that `fixed + flexible ≤ total`, and rounded `avgDuration` (and `0` on empty). This is the main coverage.
- **`domain/visitType.test.ts`** (optional) — `resolveVisitTypeLabel` fixed / flexible / mixed cases, now that it's shared.
- **[PatientsPage.test.tsx](frontend/src/tests/patients/PatientsPage.test.tsx)** — seed patients already include `visitTimeType` + `visitDurationMinutes`; assert the row renders the four labels + expected values. jsdom doesn't evaluate the `md:` breakpoint, so assert content renders; the `hidden md:grid` class is the desktop/mobile gate (verified visually in preview).

## Verification

1. **Preview (desktop):** run the dev server, open `/clients`, confirm the four cards appear above the search bar with values matching the list (Total = header count, Fixed blue, Flexible emerald, Avg "NN min"). Search a name → counts update to the filtered set.
2. **Preview (mobile):** resize to ~375px → the row is hidden; layout falls straight to the search bar.
3. **Pre-push (mandatory, from `frontend/`):** `npm run lint` and `npm run test` — fix any failures.

## Out of scope (note for later)
- A mobile rendering of the stats (collapsed/scrollable) — deliberately deferred per request.
- Wiring the cards to act as filter shortcuts (clicking "Fixed" filtering the table) — not requested.
