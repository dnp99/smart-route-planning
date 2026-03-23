# CareFlow Design System

> Single source of truth for visual design in CareFlow.
> Code implementation lives in [`frontend/src/components/responsiveStyles.ts`](../frontend/src/components/responsiveStyles.ts).
> All new UI work must use the tokens and component rules defined here — no ad-hoc Tailwind classes outside documented component specs.
> Documented component specs are the approved exception layer between tokens and implementation.

---

## 1. Foundations

### Color Tokens

| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| BG / Page | `#F8FAFC` | `slate-50` | Page canvas only — never used inside cards |
| BG / Surface | `#FFFFFF` | `white` | All cards, inputs, table rows |
| Border / Default | `#E2E8F0` | `slate-200` | Default border on all containers |
| Border / Hover | `#CBD5E1` | `slate-300` | Hover border on inputs and interactive cards |
| Text / Primary | `#0F172A` | `slate-900` | Headings, body text, table cell primary text |
| Text / Secondary | `#475569` | `slate-600` | Descriptions, subtitles, secondary body |
| Text / Muted | `#94A3B8` | `slate-400` | Labels, city/region address line, helper text |
| Brand / Primary | `#2563EB` | `blue-600` | Primary buttons, active tab, links |
| Brand / Hover | `#1D4ED8` | `blue-700` | Hover state on primary buttons |
| Status / Fixed BG | `#DBEAFE` | `blue-100` | Fixed visit type pill background |
| Status / Fixed Text | `#1E40AF` | `blue-800` | Fixed visit type pill text |
| Status / Flexible BG | `#D1FAE5` | `emerald-100` | Flexible visit type pill background |
| Status / Flexible Text | `#047857` | `emerald-700` | Flexible visit type pill text |
| Warning | `#D97706` | `amber-600` | "Leave By" time value, warning indicators |

**Dark mode:** Every token has a dark-mode counterpart in code. In Figma, use a separate dark-mode frame with `slate-950` canvas and `slate-900` surface.

---

### Typography

| Style | Size | Weight | Color | Tailwind |
|---|---|---|---|---|
| Heading / H1 | 24px | Semibold | Text/Primary | `text-2xl font-semibold text-slate-900` |
| Heading / H2 | 20px | Semibold | Text/Primary | `text-xl font-semibold text-slate-900` |
| Heading / H3 | 18px | Semibold | Text/Primary | `text-lg font-semibold text-slate-900` |
| Body / Default | 14px | Regular | Text/Primary | `text-sm text-slate-900` |
| Body / Secondary | 14px | Medium | Text/Secondary | `text-sm text-slate-600` |
| Body / Muted | 12px | Regular | Text/Muted | `text-xs text-slate-400` |
| Label / Small | 12px | Medium | Text/Muted | `text-xs font-medium text-slate-500` |
| Label / Caps | 11px | Semibold | Text/Muted | `text-[11px] font-semibold uppercase tracking-wide` |

**Rule:** Do not introduce new body or heading sizes outside the defined scale.
Allowed exceptions for dense UI metadata:
- `text-[10px]` for timeline chips and compact timestamp metadata
- `text-[11px]` for pill labels / caps micro-labels
- `text-[0.95rem]` for compact metric values where `text-sm` is too small and `text-lg` is too large
- Tracking exceptions (`tracking-[0.1em]`, `tracking-[0.14em]`, `tracking-[0.16em]`) are allowed only for chips, eyebrow labels, and other documented micro-label specs.

---

### Spacing (8pt grid)

| Name | px | Tailwind |
|---|---|---|
| xs | 4 | `p-1` / `gap-1` |
| sm | 8 | `p-2` / `gap-2` |
| md | 12 | `p-3` / `gap-3` |
| lg | 16 | `p-4` / `gap-4` |
| xl | 24 | `p-6` / `gap-6` |
| 2xl | 32 | `p-8` / `gap-8` |

**Rule:** Between sections use `gap-6` or `gap-8`. Inside a section card use `p-6`. On mobile use `p-4`.

---

### Radius

| Name | px | Tailwind |
|---|---|---|
| sm | 8 | `rounded-lg` |
| md | 12 | `rounded-xl` |
| lg | 16 | `rounded-2xl` |
| xl | 24 | `rounded-3xl` |

**Rule:** Buttons and inputs use `rounded-xl` (md). Section cards use `rounded-2xl` (lg). Pills use `rounded-full`.

---

### Shadows

| Name | Value | Tailwind | Usage |
|---|---|---|---|
| Card | `0 1px 2px rgba(0,0,0,0.05)` | `shadow-sm` | All surface cards |
| Hover | `0 2px 6px rgba(0,0,0,0.08)` | `shadow` | Card hover state, metric cards |
| Elevated | `0 4px 12px rgba(0,0,0,0.1)` | `shadow-md` | Popovers, sticky subpanels, secondary elevated surfaces |

**Rule:** Never stack more than one shadow level. Cards get `shadow-sm`. Header/footer use blur-first chrome, while `shadow-md` is reserved for true elevated surfaces.

---

## 2. Layout

### Page Shell

```
┌──────────────────────────────────────────────────────────────────┐
│ Header (full width, sticky, bg-slate-50/95 backdrop-blur-sm)     │
├──────────────────────────────────────────────────────────────────┤
│ Tab bar (full width, border-b)                                   │
├──────────────────────────────────────────────────────────────────┤
│  bg-gradient-to-b from-slate-50 to-white canvas                  │
│  ┌────────────────────────────────────┐                          │
│  │  max-w-7xl  mx-auto  px-4 sm:px-6  │                          │
│  │  pb-6                              │                          │
│  │  [page content]                    │                          │
│  └────────────────────────────────────┘                          │
├──────────────────────────────────────────────────────────────────┤
│ Footer (full width, bg-transparent)                              │
└──────────────────────────────────────────────────────────────────┘
```

- **Max width:** `max-w-7xl` (80rem / 1280px)
- **Horizontal padding:** `px-4 sm:px-6`
- **Canvas:** `bg-gradient-to-b from-slate-50 to-white` on the outer flex container
- **Between sections:** `mt-6` or `mt-8`
- **Width policy:** keep app shell at `max-w-7xl`, but use narrower inner constraints for form/auth and dense data regions when readability benefits.
- **Footer text baseline:** use low-emphasis text (`text-xs text-slate-500`) and keep footer visually subordinate to page content.

### Section Block

Every page section follows this structure:

```
[H1 Page Title]
[Body/Secondary description]

[Controls Row — search + CTA]

[Primary Content Card]
  bg-white  border-slate-200  rounded-2xl  shadow-sm  p-4 sm:p-6
```

---

## 3. Components

### Card

The universal container for all content groups.

```
bg-white
border border-slate-200
rounded-2xl
shadow-sm
p-4 sm:p-6 md:p-8
```

**Interactive card** (collapsible panels in Route Planner):
```
... + hover:border-slate-300 cursor-pointer
```

**Rules:**
- Background canvas (`bg-slate-50`) is for contrast only — never put gray cards on a white background
- All primary containers are white
- Never mix gray cards and white cards at the same level

---

### Button — Primary

```
bg-blue-600
text-white
rounded-xl
px-4 py-2
text-sm font-semibold
hover:bg-blue-700
disabled:opacity-60 disabled:cursor-not-allowed
```

Use for: Optimize Route, Add Patient, Save, Submit.

### Button — Secondary

```
bg-slate-100
text-slate-700
rounded-xl
px-3 py-2
text-sm font-medium
hover:bg-slate-200
disabled:opacity-60 disabled:cursor-not-allowed
```

Use for: Cancel, Edit trip, Edit patients, Close.

**Rule:** Never put a border on a secondary button. If you need a border, use a ghost/outline variant explicitly.

### Button — Outline (for contextual utility actions)

```
border border-slate-300
bg-white text-slate-700
rounded-xl
px-3 py-1.5
text-sm
hover:bg-slate-50
disabled:opacity-60 disabled:cursor-not-allowed
```

Use for: contextual utility actions inside info banners and inline system notices (e.g. "Reset order").

---

### Input Field

```
bg-white
border border-slate-200
rounded-xl (or rounded-2xl for search)
px-3 py-2.5 sm:px-4 sm:py-3
text-sm text-slate-900
hover:border-slate-300
focus:border-blue-500 focus:ring-2 focus:ring-blue-100
outline-none transition
```

States:
- **Default:** `border-slate-200 bg-white`
- **Hover:** `border-slate-300`
- **Focus:** `border-blue-500 ring-2 ring-blue-100`
- **Disabled:** `bg-slate-100 opacity-60 cursor-not-allowed`

**Rule:** Inputs are always `bg-white`. Never `bg-slate-50` for an active input.

#### Clear button (search inputs)

When a search input has a non-empty value, show a × button inside the right edge:

```
absolute right-2.5 top-1/2 -translate-y-1/2
rounded p-0.5 text-slate-400
transition hover:text-slate-700
```

- Icon: 14×14 × SVG
- Input gains `pr-8` when the button is visible to prevent text overlap
- Clicking clears the field and resets results

---

### Status Pill

| Variant | BG | Text | Tailwind |
|---|---|---|---|
| Fixed | blue-100 | blue-700 | `bg-blue-100 text-blue-700` |
| Flexible | emerald-100 | emerald-700 | `bg-emerald-100 text-emerald-700` |
| Mixed | amber-100 | amber-700 | `bg-amber-100 text-amber-700` |

```
inline-flex rounded-full px-2 py-0.5
text-[11px] font-semibold uppercase tracking-wide
```

---

### Table

**Header row:**
```
bg-slate-50
border-b border-slate-200
text-xs font-medium text-slate-500 tracking-normal
px-4 py-3
```

**Data row:**
```
border-b border-slate-100
hover:bg-slate-50 transition
height: ~56–64px (py-5)
group (for hover-reveal actions)
```

**Cell alignment rules:**
- Name (primary text): left, `font-bold`, `line-clamp-2`
- Address: left, two lines — street `text-sm text-slate-800`, city `text-xs text-slate-400`
- Preferred window: left, pill + time inline
- Duration: right-aligned
- Actions: right-aligned, `opacity-0 group-hover:opacity-100`
- Desktop table rows may use hover-reveal for row actions.
- Mobile/touch layouts must use always-visible actions or a persistent overflow menu.

**Column widths:**

| Column | Width |
|---|---|
| Name | `w-[32%]` |
| Address | `w-[38%]` |
| Window | `w-[20%]` |
| Duration | `w-20` |
| Actions | `w-20` |

---

### Metric Card (Route Planner)

```
bg-white
border border-slate-200
rounded-xl
px-3 py-3
shadow-sm
hover:shadow transition
```

**Text:**
- Label: `text-xs font-medium text-slate-500`
- Value: `text-[0.95rem] sm:text-lg font-semibold text-slate-900`
- Subtext: `text-xs text-slate-500 sm:text-sm`

**Leave By exception:** value uses `text-amber-600` instead of `text-slate-900` to signal urgency.

---

### Collapsible Panel Row (Route Planner — collapsed state)

```
bg-white
border border-slate-200
rounded-2xl
shadow-sm
p-3 sm:p-4
```

- Summary text: `text-sm text-slate-700`
- "Edit" link: `text-blue-600 hover:underline underline-offset-2`
- Chevron icon: `text-slate-400 hover:text-slate-600`

---

### Clickable Text (e.g. "+2 more")

```
text-blue-600 font-medium underline underline-offset-2 cursor-pointer
```

**Rule:** Always underlined (not just on hover) so the affordance is obvious at a glance, especially in dense table cells.

---

## 4. Page Templates

### Patients Page

```
<main>                           ← responsiveStyles.page
  <section>                      ← responsiveStyles.section (white card)

    [H1] Patients (N)           ← "Patients (N of M)" when search is active
    [Body/Secondary] Manage patients for route planning.

    [Search input + Add Patient button]
      Search: responsiveStyles.searchInput + pl-9 for icon
      Button: bg-blue-600 primary style

    [PatientsTable]
      Table card (hidden on mobile, md:block)
      Mobile cards (md:hidden)

  </section>
</main>
```

### Route Planner Page

```
<main>                           ← responsiveStyles.page
  <section>                      ← responsiveStyles.section (white card)

    [H1] Smart Route Planner
    [Body/Secondary] Description

    <form>
      [Mobile step nav]          ← only on mobile

      [Trip Setup panel]         ← responsiveStyles.panel (white card)
      [Patient Search panel]     ← responsiveStyles.panel
      [Selected Destinations]    ← responsiveStyles.destinationList

      [Footer row]
        [Visits queued pill]     ← neutral, muted
        [Optimize Route button]  ← bg-blue-600 primary
    </form>

    [OptimizedRouteResult]       ← border-t mt-6 pt-6 separator
      [Dispatch Plan card]       ← gradient container
        [4 Metric cards]         ← 2-col mobile / 4-col desktop
      [Timeline card]            ← white card
      [Map card]                 ← white card (sticky on xl)

  </section>
</main>
```

---

## 5. Interaction Rules

### Hover

| Element | Behavior |
|---|---|
| Table row | `hover:bg-slate-50` |
| Input | `hover:border-slate-300` |
| Interactive card / panel | `hover:border-slate-300` |
| Primary button | `hover:bg-blue-700` |
| Secondary button | `hover:bg-slate-200` |
| Metric card | `hover:shadow` |

### Focus

All interactive elements must show a visible focus ring:
```
focus-visible:ring-2 focus-visible:ring-blue-500/50
```
Inputs use a softer ring:
```
focus:ring-2 focus:ring-blue-100
```

### Action reveal (table rows)

Inline edit/delete buttons are hidden until row hover:
```
opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100
```
See §3 Table for canonical desktop/mobile action behavior.

---

## 6. Anti-patterns

These are **never** acceptable:

| Anti-pattern | Instead |
|---|---|
| `bg-slate-100` or `bg-slate-50` inside a white card | Use `bg-white` consistently |
| Gray cards mixed with white cards at same level | All sibling cards must use the same surface |
| `border-slate-300` as a default border | Use `border-slate-200` default, `border-slate-300` on hover only |
| Hardcoded spacing not on the 8pt grid | Use token spacing only |
| More than two font sizes in one card | Map all text to the typography table |
| Shadows stacked: `shadow + shadow-md` | One shadow level per element |
| Ad-hoc inline Tailwind classes outside documented component specs | Use `responsiveStyles` tokens or documented component exceptions |
| `bg-slate-50` on a focused input | Inputs are always `bg-white` |

---

## 7. Code Rules

- **Every reusable style** lives in [`responsiveStyles.ts`](../frontend/src/components/responsiveStyles.ts)
- **Components consume tokens** via `responsiveStyles.X`; inline classes are allowed only when explicitly documented in this spec
- **One-off overrides** (e.g. `pl-9` for icon inset on search) are the only acceptable inline additions
- **Dark mode** is handled via `dark:` variants inside the token — components never add their own dark variants

---

## 8. Token → Code Mapping

| Design token | `responsiveStyles` key |
|---|---|
| Page section card | `section` |
| Input panel (collapsible) | `panel` |
| Search input | `searchInput` |
| Primary button | `primaryButton` |
| Secondary button | `secondaryButton` |
| Outline button | `outlineButton` |
| Visit type pill | inline in `renderVisitTypePill()` (PatientsTable) |
| Metric card | `resultStatCard` |
| Metric label | `resultStatLabel` |
| Metric value | `resultStatValue` |
| Metric subtext | `resultStatMeta` |
| Optimize button | `optimizeButton` |
| Google Maps button | `googleMapsButton` |
| Destination list | `destinationList` |
| Count/status pill | `countPill` |

---

## 9. Route Timeline Components

Formal specs for the components that make up the visit-order timeline in the Route Planner result.

---

### 9a. Timeline Stop Card

The primary list item in the visit order. Each card represents one scheduled task at a stop.

**States:**

| State | Styles |
|---|---|
| Default | `bg-white border-slate-200 shadow-sm` |
| Hover | `hover:bg-slate-50` (via toggle button) |
| Expanded | `border-blue-200 bg-blue-50/50 dark:border-blue-700/60 dark:bg-blue-950/20` + details section visible |
| Disabled (can't move) | move-control buttons at `opacity-40 cursor-not-allowed` |

**Rules:**
- Only one card can be expanded at a time per route result
- Expanded state uses Blue (`border-blue-200 bg-blue-50/50`) — Blue = selection only (§12)
- Move controls (`▲ ▼`) are `absolute right-2 top-2`, header row must add `pr-9` to avoid pill overlap
- Toggle chevron rotates 90° when expanded

**Header row layout:**
```
[chevron] [N. Patient Name ··················] [STATUS CHIP] [▲]
                                                              [▼]
```

**Below header:**
```
Expected start  ~HH:MM AM    [ESTIMATED]
Window: HH:MM – HH:MM | N hr visit
Outside preferred window by N min   ← red, only when late
```

---

### 9b. Status Chips (Timeline)

Used inside timeline stop cards only.

| Chip | Border | BG | Text | Tailwind |
|---|---|---|---|---|
| On Time | `emerald-200` | `emerald-50` | `emerald-700` | `border-emerald-200 bg-emerald-50 text-emerald-700` |
| Late | `red-200` | `red-50` | `red-700` | `border-red-200 bg-red-50 text-red-700` |
| Open window | `slate-200` | `slate-100` | `slate-600` | `border-slate-200 bg-slate-100 text-slate-600` |
| Estimated | `blue-200` | `blue-50` | `blue-700` | `border-blue-200 bg-blue-50 text-blue-700` |

```
inline-flex items-center rounded-full border px-2 py-0
text-[10px] font-semibold uppercase tracking-[0.1em]
```

**Rules:**
- Never mix chip colors for the same semantic meaning
- "Estimated" chip appears only when `isStale === true` (times are user-adjusted estimates)
- "On Time" / "Late" chips communicate arrival status vs. preferred window — not the same axis as Estimated

---

### 9c. Break Card

Represents a non-service idle gap between stops (or between tasks within the same stop) that is ≥ 30 min.

```
border border-blue-200 bg-blue-50/80 rounded-2xl
px-4 py-2 shadow-sm
dark:border-blue-900/50 dark:bg-blue-950/20
```

**Layout:**
```
[☕ icon]  Break · Xh Ym
           HH:MM AM – HH:MM AM
```

- Icon: coffee-cup SVG, `h-4 w-4 text-blue-600`
- Duration label: `text-sm font-semibold text-blue-800`
- Time range: `text-xs text-blue-700/90`
- Prefix `~ ` when `isStale === true`

**Rules:**
- Must visually differ from visit stop cards — uses indigo/blue tint, no patient name, no status chip
- Fires between any two consecutive tasks (cross-stop OR within the same multi-task stop) when gap ≥ `BREAK_GAP_THRESHOLD_MINUTES` (30)
- Inter-stop break: computed from `prevStop.departureTime` → `nextStop.tasks[0].serviceStartTime − travelMs`
- Inter-task break: computed from `prevTask.serviceEndTime` → `task.serviceStartTime`

---

### 9d. Final Stop Card (Ending Stop)

Visually distinct from visit cards to indicate the route terminus.

```
border border-dashed border-slate-300 bg-slate-50 rounded-2xl
px-3 py-2.5
dark:border-slate-700 dark:bg-slate-950/40
```

- Eyebrow: `text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400` → "FINAL STOP"
- Address / "Home": `text-sm font-semibold text-slate-900`
- ETA (home): `text-sm font-semibold text-emerald-700` — the only place Green is used in the timeline
- Distance/travel meta: `text-xs text-slate-500`

**Rules:**
- Dashed border communicates non-visit, terminus nature
- `bg-slate-50` is permitted here (exception to the white-card rule) because the card is intentionally de-emphasized
- Green text (`emerald-700`) for the ETA is success-signal only — matches Green = success semantic in §12
- Any exception to core surface rules must be explicitly documented at the component level in this spec.

---

### 9e. Info Banner

Used for system-level status messages that need inline action buttons (e.g. "Route manually adjusted").

```
bg-blue-50 border border-blue-200 rounded-2xl
px-4 py-3 text-sm font-medium text-blue-700
dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300
```

**Actions inside the banner:**
- Secondary action (e.g. "Reset order"): `border border-slate-300 bg-white text-slate-700 rounded-xl px-3 py-1.5 text-sm`
- Primary action (e.g. "Recalculate times"): `bg-blue-600 text-white rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-blue-700`

**Rules:**
- Only used for transient system state (stale route, network status) — not for validation errors
- Always contains exactly one primary action; secondary action is optional
- Never used for empty states or errors (use §11 table states / inline error message instead)

---

## 10. State System

Every interactive component must handle all applicable states below consistently.

| State | Visual treatment |
|---|---|
| Default | Base styles — `border-slate-200 bg-white` |
| Hover | `border-slate-300` on inputs/panels; `bg-slate-50` on rows; `hover:shadow` on metric cards |
| Focus | `ring-2 ring-blue-100 border-blue-500` on inputs; `ring-2 ring-blue-500/50` on buttons |
| Disabled | `opacity-60 cursor-not-allowed` — never remove from DOM |
| Selected / Active | `border-blue-200 bg-blue-50/50` — see §12 |
| Error | `border-red-400` on input; inline `text-red-600` message below |
| Loading | Skeleton placeholder at the same height as the real element |
| Empty | Centered `text-slate-500` message inside the container |

**Rule:** Never rely on color alone to communicate state.
Required non-color companions:
- Selected = border + tint
- Error = border + inline message
- Disabled = opacity + cursor
- Focus = ring + border

---

## 11. Table States

All tables must implement every state without layout shift.

### Empty state
```
rounded-2xl border border-slate-200 bg-white px-4 py-10
text-center text-sm text-slate-500
```
- Single sentence, no heading
- Example: "No patients found." / "No results match your search."

### Loading state
- Render **skeleton rows** at the same height as data rows (`py-5`)
- Skeleton cells: `rounded bg-slate-100 animate-pulse h-4`
- Show the same number of columns — no layout shift when data arrives
- Never show a spinner inside the table body

### Error state
```
rounded-2xl border border-red-200 bg-red-50 px-4 py-4
text-sm text-red-700
```
- Render inside the table container, not above it
- Include a retry action if the error is recoverable

### Populated state (normal)
- Apply `divide-y divide-slate-100` on `<tbody>` for row separation
- Row hover: `hover:bg-slate-50 transition`
- Action buttons: `opacity-0 group-hover:opacity-100 focus-within:opacity-100`

---

## 12. Selected / Active Pattern

Used wherever a user makes a selection that persists visually.

```
border-blue-200 bg-blue-50/50
dark:border-blue-700/60 dark:bg-blue-950/20
```

**Applied to:**
- Expanded timeline stop card (`isExpanded === true`)
- Selected table row (if row-selection is added)
- Active card in any card-picker pattern

**Color semantics (enforce everywhere):**

| Color | Meaning | Never use for |
|---|---|---|
| Blue | Selection / active / focus | Success, warnings |
| Green | Success / on-time status | Active state |
| Amber | Warning / time-sensitive | Errors |
| Red | Error / late / destructive | Warnings |

---

## 13. Page Background Token

```
bg-gradient-to-b from-slate-50 to-white
dark:bg-none dark:bg-slate-950
```

Applied to the **outermost flex container** (`App.jsx`), not to individual sections.

**Rules:**
- Always use the gradient on the page container — never flat `bg-slate-50` or `bg-white` at page level
- Do not apply any background to the content wrapper div — it must be transparent so the gradient shows through
- Section cards (`bg-white shadow-sm`) provide the white surface; the gradient is the canvas

---

## 14. Mobile Rules

### Spacing
| Context | Mobile | Desktop |
|---|---|---|
| Card padding | `p-4` | `p-6 md:p-8` |
| Section gap | `gap-4` | `gap-6 sm:gap-8` |
| Form gap | `gap-2.5` | `gap-3` |
| Button padding | `px-3 py-2` | `px-4 py-2` |

### Layout
- Tables → switch to stacked card layout below `md` (`hidden md:block` / `md:hidden`)
- Buttons → full width on mobile (`w-full sm:w-auto`)
- Inputs → always full width (`w-full`)
- Two-column grids → single column below `sm`

### Typography
- Use the same type scale at all breakpoints — never scale down below the defined sizes
- Exceptions follow §1 Typography (pill labels, eyebrow labels, compact metadata, compact metric values)

### Touch targets
- All interactive elements minimum `44px` tall on mobile
- Icon-only buttons: `h-10 w-10` minimum
- Inline action buttons (table row): `h-7 w-7` minimum

---

## 15. Interaction Priority

Only **one primary action** is allowed per section. All other actions are secondary or tertiary.

| Level | Style | Token | Example |
|---|---|---|---|
| Primary | Blue filled button | `primaryButton` / `optimizeButton` | Optimize Route, Add Patient, Save |
| Secondary | Gray filled button (no border) | `secondaryButton` | Cancel, Edit trip, Close |
| Utility | Neutral outlined button | `outlineButton` (or component-specific documented equivalent) | Contextual system actions inside banners/panels (e.g., Reset order) |
| Tertiary | Text link | `text-blue-600 hover:underline` | Edit (collapsed panel), "+2 more" |

**Rules:**
- Primary and secondary buttons never appear side-by-side at equal visual weight — primary must be clearly dominant
- Utility outlined actions are contextual support actions and must not visually compete with primary CTAs
- Destructive actions (Delete, Logout) use red text (`text-red-600 hover:bg-red-50`) not a red button
- Disabled state uses `opacity-60 cursor-not-allowed` — never hide a disabled button

---

## 16. Component Naming Rules

Consistent terminology prevents confusion between developers and design.

| Term | Meaning | Example |
|---|---|---|
| **Card** | Static white container, no interactive state changes | Metric card, patient mobile card |
| **Panel** | Interactive container — can collapse, expand, or be edited | Trip setup panel, Patient search panel |
| **Section** | Page-level grouping with a title and description | The `<section>` wrapping all of Patients or Route Planner |
| **Row** | A single record inside a table or list | Table data row, destination list row |
| **Pill** | Small inline badge communicating type or status | Fixed/Flexible pill, On time chip |
| **Modal** | Full overlay dialog | PatientFormModal, Account settings |
| **Sticky footer** | Fixed bottom bar on mobile forms | Mobile step navigation footer |

**Figma naming convention:**
```
Button / Primary / Default
Button / Primary / Hover
Button / Secondary / Default

Card / Default
Card / Interactive

Input / Default
Input / Focus
Input / Error

Table / Header
Table / Row / Default
Table / Row / Hover

Pill / Fixed
Pill / Flexible
Pill / Mixed

Panel / Collapsed
Panel / Expanded
```

---

## 17. Alert Cards

Used for system-level warnings, conflicts, and risks. Always rendered below the main content area.

### Variants

| Type | Border | BG | Text | Label color |
|---|---|---|---|---|
| Info | `border-blue-200` | `bg-blue-50` | `text-blue-700` | `text-blue-600` |
| Warning (Exceptions) | `border-amber-200` | `bg-amber-50` | `text-amber-800` | `text-amber-600` |
| Error (Timing Risk) | `border-red-200` | `bg-red-50` | `text-red-700` | `text-red-600` |

### Structure

```
[LABEL — small caps eyebrow]
[Title — bold]
[Description — body text]
[× dismiss button — top-right]
```

```
rounded-2xl border px-4 py-3 shadow-sm
```

- Eyebrow label: `text-xs font-semibold uppercase tracking-[0.16em]` (variant label color)
- Title: `text-sm font-semibold` (variant-tinted: `text-amber-900` for Warning, `text-red-900` for Error)
- Description: `text-sm` (variant text color)
- Dismiss: `h-5 w-5 text-slate-400 hover:text-slate-600 absolute top-3 right-3`

### Rules

- Always full-width within their grid column
- One alert type per card — never mix Warning + Error in a single card
- Multiple alerts render as a row of cards (2-col grid on desktop, stacked on mobile)
- Dismiss (×) is optional; only show when the user can meaningfully act on it
- Use concise, actionable copy — max 2 sentences

---

## 18. Section Headers

Every major region of the page uses a consistent header structure.

### Eyebrow label (all-caps section identifier)

```
text-xs font-semibold uppercase tracking-wide text-slate-500
dark:text-slate-400
```

Examples: `ROUTE TIMELINE`, `MAP OVERVIEW`, `EXCEPTIONS`, `TIMING RISK`

### Section title

```
text-lg font-semibold text-slate-900 dark:text-slate-100
```

### Right-side meta pill (e.g. "2 stops")

```
inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-white
px-3 py-1 text-xs font-semibold text-slate-600
dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300
```

### Rules

- Eyebrow always precedes title — never title alone without eyebrow in a panel/card context
- Meta pill is optional; only use for counts or single key facts
- Never put an action button in the eyebrow row — actions go in the title row or below

---

## 19. Inline Status Messages (Timeline)

Short contextual messages rendered inside stop cards to explain timing outcomes.

| Type | Tailwind | When used |
|---|---|---|
| Late / error | `text-xs font-semibold text-red-600 dark:text-red-400` | Arrival outside preferred fixed window |
| Warning | `text-xs font-semibold text-amber-600 dark:text-amber-400` | Arrival outside flexible window by > 60 min |
| Success | `text-xs font-semibold text-emerald-700 dark:text-emerald-300` | Final stop ETA (EndingStopCard only) |

**Rules:**

- Always renders below the window/duration metadata line
- One message per card — never stack two inline status messages
- Never use `font-bold` — `font-semibold` maximum
- Keep to a single line; truncate or rephrase if it wraps

---

## 20. Map Markers

Markers on the Leaflet route map must follow timeline color semantics.

| Marker type | Color | When |
|---|---|---|
| Regular stop | Blue (`#2563EB`) | Patient visit stops |
| Final destination | Red (`#EF4444`) | Ending point (E marker) |
| Active / selected | Darker blue (`#1D4ED8`) | When the corresponding card is expanded |

**Rules:**

- Marker colors must follow map role semantics, not timing status semantics:
  - stop = blue
  - endpoint = red
  - selected = darker blue
- Marker labels use initials (e.g. `RR`, `DP+DP`) — match the patient name abbreviation logic
- Active/selected state is a darker stroke, not a different hue

---

## 21. Elevation / Depth System

Defines how layers stack visually so nothing feels flat or cluttered.

| Level | Context | Style |
|---|---|---|
| Base | Page canvas | `bg-gradient-to-b from-slate-50 to-white` (no shadow) |
| Level 1 | Cards, panels, table rows | `shadow-sm` |
| Level 2 | Hovered cards, metric cards on hover | `shadow` (one step up from `shadow-sm`) |
| Level 3 | Sticky/elevated chrome: header, footer | `bg-slate-50/95 backdrop-blur-sm` (no shadow — blends with canvas) |
| Level 4 | Modal dialog surface | `shadow-2xl` |

**Rules:**

- Never skip levels — a card can go from `shadow-sm` → `shadow` on hover, not `shadow-sm` → `shadow-xl`
- Never stack two shadow utilities on the same element
- Modals always sit on a `bg-slate-950/45` backdrop at z-50

---

## 22. Auth Page Template

Use this template for login, sign-up, forgot password, and password reset screens.

```
<app shell>                       ← same page canvas token
  <header>                        ← standard app header (logged-out variant)
  <content wrapper>               ← max-w-7xl + horizontal padding
    <auth container>              ← narrower inner constraint (`max-w-xl mx-auto`)
      <auth card>                 ← white surface card
    </auth container>
  <footer>                        ← standard low-priority footer
</app shell>
```

### Auth card baseline

```
bg-white border border-slate-200 rounded-2xl shadow-sm
p-4 sm:p-6
```

### Auth width policy

- Keep the global app shell wide (`max-w-7xl`) for header/footer alignment.
- Login/reset forms should use a narrow focal column: `max-w-xl mx-auto`.
- Use `max-w-2xl` only when auth content is materially larger (multi-field sign-up, legal copy, or split content).
- Segmented controls must stay inside the same auth-width container as the form.

### Auth form baseline

- Field stack: `space-y-4`
- Label to input gap: `mb-1`
- Inputs: use input token/state rules from §3 Input Field
- Primary submit button: full-width by default
- Auth primary submit remains full-width at desktop unless a specific workflow requires a documented exception

### Auth spacing rhythm

- Segmented control → title: `mt-6`
- Title → description: `mt-3`
- Description → first field: `mt-6`
- Field stack: `space-y-4`
- Last field → primary button: `mt-5`
- Helper row (forgot password / mode switch) under password or CTA with `mt-3`

### Auth-specific rules

- Keep auth content visually narrower than dashboard/data surfaces.
- Vertically center the auth focal zone within remaining viewport space (between header and footer), not pinned high like dashboard content.
- Keep one primary CTA per screen section.
- Use segmented controls/tabs only for closely related mode switches (e.g., Login / Sign up).
- Auth screens use the same color, spacing, and typography rules as the rest of the system (no separate visual theme).
- Keep footer visually quiet and separated from auth card with clear breathing room.

---

## 23. Modal Component Spec

Modal is the canonical overlay dialog primitive for focused workflows (confirmations, account settings, form subflows).

### Structure

```
<backdrop>
  <dialog surface>
    <header>
    <body>
    <footer actions>
```

### Tokens

- Backdrop: `bg-slate-950/45` at `z-50`
- Surface: `bg-white border border-slate-200 rounded-2xl shadow-2xl`
- Mobile behavior: sheet-like bottom presentation is allowed when documented (e.g., rounded top corners)
- Desktop behavior: centered dialog

### Sizes

| Size | Max width |
|---|---|
| Small | `sm:max-w-sm` |
| Medium (default) | `sm:max-w-xl` |
| Large | `sm:max-w-2xl` |

### Actions

- Primary action: `primaryButton`
- Secondary action: `secondaryButton`
- Utility contextual action (if needed): `outlineButton` or documented equivalent
- Destructive actions default to red text treatment (`text-red-600 hover:bg-red-50`)
- A destructive filled primary button is allowed only in irreversible confirmation modals and only when it is the sole primary action

### Accessibility rules

- Use proper dialog semantics (`role="dialog"` or native dialog semantics), with labeled title.
- Focus must move into the modal on open and return to trigger on close.
- `Escape` closes dismissible modals.
- Click-outside behavior is optional and must match workflow risk (disable for destructive/high-risk confirmations when needed).
- Keep keyboard navigation fully operable for all controls.

### Behavior rules

- One modal stack at a time by default (avoid nested modal flows).
- Modal body scrolls when content exceeds viewport; header/footer stay readable.
- Use concise titles and direct action labels.
- Footer action layout:
  - Mobile: stacked actions, full-width
  - Desktop: right-aligned action row with `gap-3`

---

## 24. Segmented Control (Tabs)

Use segmented controls for switching between closely related views in the same local context (e.g., Login / Sign up).

### Base styles

- Container: `bg-slate-100 rounded-lg p-1 flex`
- Segment button (inactive): `flex-1 text-slate-600`
- Segment button (active): `bg-white shadow-sm text-slate-900 font-semibold`

### Rules

- Equal-width segments in the same control.
- Exactly one active segment at a time.
- No outer border; rely on surface contrast.
- Include visible focus treatment for keyboard navigation.
- Use segmented controls for local mode switches, not for top-level app navigation.
- Top-level navigation must continue using page/tab nav patterns.

---

*Last updated: 2026-03-23*
