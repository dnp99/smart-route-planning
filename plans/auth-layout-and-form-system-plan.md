# Auth Layout + Form System Plan

## Status

- Proposed
- Phase 1: Pending
- Phase 2: Pending
- Last updated: 2026-03-23

## Objective

Define and implement a consistent auth-page UI pattern for:

- Login
- Sign up
- Shared auth form primitives

This plan closes current design-system gaps for layout, segmented tabs, input states, spacing rhythm, button width behavior, and app footer treatment.

Design-system source of truth for implementation:

- `docs/design-system.md`
- `frontend/src/components/responsiveStyles.ts`

## Scope

### In scope

- Reusable auth page layout (top nav + centered card + footer)
- Login/Sign up segmented control (tabs)
- Input field system with explicit visual states
- Form spacing pattern and vertical rhythm rules
- Button width rules by context
- Footer baseline style and structure for auth pages
- Minor visual consistency fixes from review notes

### Out of scope

- Dashboard layout redesign
- Authentication backend/API behavior changes
- Copy/content rewrite beyond small UI labels and helper text

## Design Decisions

### 1. Auth Layout (new reusable page pattern)

- Structure:
  - Top navigation (logo, date optional)
  - Centered container card
  - Footer (links + copyright)
- Container baseline: `max-w-xl mx-auto mt-20`
- Card baseline: `bg-white border border-slate-200 rounded-2xl p-6 shadow-sm`
- Rules:
  - Always center content horizontally
  - Maintain generous vertical spacing
  - Do not reuse dashboard grid layout
  - Use responsive top spacing:
    - Mobile: `mt-12`
    - Desktop (`md`+): `mt-20`
  - Use responsive card padding:
    - Mobile: `p-4`
    - Desktop (`sm`+): `p-6`

### 2. Tabs / Segmented Control (Login / Sign up)

- Container: `bg-slate-100 rounded-lg p-1 flex`
- Tab:
  - Default: `text-slate-600`
  - Active: `bg-white shadow-sm text-slate-900`
- Rules:
  - Equal width tabs
  - Only one active at a time
  - No border; rely on background contrast
  - Active tab must remain visually distinct
  - Keyboard interaction:
    - `Tab` moves focus in normal document order
    - Arrow keys switch focused tab in segmented group
    - `Enter`/`Space` activates focused tab
  - Hover/focus-visible:
    - Hover should slightly increase text contrast on inactive tabs
    - Focus-visible must show a clear ring without removing active contrast
  - Login/sign-up state should stay in sync with route/view state (no hidden local-only mismatch)

### 3. Input Field System

- Base input: `w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm`
- Label: `text-sm font-medium text-slate-700`
- State styles:
  - Default: `border-slate-200`
  - Hover: `border-slate-300`
  - Focus: `border-blue-500 ring-2 ring-blue-100`
  - Error: `border-red-500 ring-red-100`
  - Disabled: `bg-slate-100 opacity-60 cursor-not-allowed`
- Rules:
  - Always show label above input
  - Placeholders are supportive only, never primary labels
  - Disabled inputs must use consistent affordances (`cursor-not-allowed`, reduced emphasis)

### 4. Form Spacing Pattern

- Field stack: `space-y-4`
- Label to input gap: `mb-1`
- Primary button spacing: `mt-4`
- Rule: preserve vertical rhythm (no arbitrary one-off margins)

### 5. Button Width Rules

| Context | Width |
| --- | --- |
| Forms | `w-full` on mobile, `sm:w-auto` by default token |
| Inline actions | auto |
| Cards (primary CTA) | full width |

Rule: use shared button tokens as-is; only force full width at larger breakpoints when explicitly required by product UX.

### 6. Footer Baseline

- Structure:
  - Left: logo + copyright
  - Right: links (`Contact`, `Terms`, `Privacy`)
- Style baseline: `text-xs text-slate-500 flex justify-between items-center`
- Rules:
  - Low visual priority
  - No border or heavy background

## Consistency Fixes Required

1. Strengthen active tab contrast (`shadow-sm` + clear white active surface).
2. Standardize input borders to design-system defaults (`border-slate-200`, `border-slate-300` on hover).
3. Use increased auth-page top separation (`mt-20` baseline).

## Accessibility + Interaction Requirements

1. Add clear `focus-visible` treatment for tabs, inputs, and buttons.
2. Ensure only one active tab in segmented control and keyboard navigation works.
3. For errors:
   - Show inline message near relevant field.
   - Mark invalid fields with `aria-invalid="true"`.
   - Connect messages using `aria-describedby`.
4. Preserve readable contrast for default and active tab states.
5. Error timing and behavior:
   - On submit: show all failing required-field errors.
   - On blur: show field-level errors for touched invalid fields.
   - On input: clear error state as soon as field becomes valid.

## Component Ownership + Contracts

### Ownership

1. `AuthLayout` owns page shell composition:
   - Top navigation slot
   - Center container + card wrapper
   - Footer slot/default footer
2. `AuthSegmentedTabs` owns login/sign-up switching UI and keyboard interaction.
3. `FormField` (or equivalent shared field pattern) owns:
   - Label rendering
   - Input base class + state classes
   - Error text rendering + `aria` linkage
4. `AuthFooter` owns low-priority footer content style + responsive wrapping behavior.

### Contracts (minimum)

1. `AuthLayout`:
   - `title` (optional), `children`, `footer` (optional override)
2. `AuthSegmentedTabs`:
   - `options`, `activeKey`, `onChange`
3. `FormField`:
   - `id`, `label`, `error`, `disabled`, input props passthrough
4. `AuthFooter`:
   - links list + optional branding text/logo slot

## Responsive Specification

1. Supported breakpoints for QA:
   - 375px mobile width
   - 768px tablet width
   - 1280px desktop width
2. Layout behavior:
   - Card remains centered at all breakpoints
   - Footer may wrap on smaller screens; maintain readable spacing and low emphasis
   - Tabs stay equal-width and legible on mobile

## Tokenization Strategy

1. Implement auth styles through shared tokens in `responsiveStyles.ts` (or equivalents that map directly to it).
2. Avoid repeating long utility strings in each page-level form.
3. Any one-off deviation must be documented inline with rationale and reviewed against `docs/design-system.md`.
4. Include dark-mode classes for all new auth primitives, consistent with existing token patterns.

## Implementation Plan

### Phase 1: Shared primitives + auth layout

1. Introduce/normalize shared class patterns for:
   - Auth page shell
   - Card
   - Tabs
   - Input styles
   - Buttons and footer
2. Ensure these patterns are defined in shared tokens (not page-local ad-hoc class strings).
3. Refactor login and sign-up views to use the same auth shell and form spacing pattern.
4. Implement component contracts (`AuthLayout`, tabs, field pattern, footer) before page migration.
5. Migrate one auth view first (login), validate, then migrate sign-up.

### Phase 2: Consistency hardening

1. Apply button width rules in all auth forms.
2. Apply footer baseline to auth pages.
3. Validate focus/error/disabled states and spacing consistency.
4. Run quick responsive checks (mobile + desktop) for container/card spacing.
5. Remove remaining one-off auth style overrides.

## QA Checklist

- Login and sign-up use shared auth layout pattern.
- Segmented tabs have equal width and clear active state.
- Inputs use consistent base + focus/error/disabled states.
- Labels are always visible above inputs.
- Form primary button follows token width behavior (`w-full` mobile, `sm:w-auto` unless explicit override).
- Footer remains low emphasis and aligned with baseline structure.
- Keyboard navigation works for tabs and form controls.
- Error messages are announced and visually associated with fields.
- Focus-visible ring is visible on tabs, inputs, and buttons via keyboard.
- Validation behavior matches spec (submit/blur/input timing).
- Footer wraps cleanly on mobile without overlap or clipping.
- New auth UI uses shared tokens and does not introduce page-local ad-hoc utility bundles.

## Definition Of Done

1. Shared auth components are used by both login and sign-up pages.
2. No page contains ad-hoc spacing or state classes that duplicate shared primitives.
3. Accessibility checks pass:
   - Keyboard-only navigation for tabs and form controls
   - Proper `aria-invalid` and `aria-describedby` wiring
4. Visual checks pass at 375px, 768px, and 1280px widths.
5. Dark-mode visuals match tokenized styles for auth primitives.
6. QA checklist items are validated and documented in PR notes.

## Risks

- Utility-class drift if patterns are not centralized.
- Visual regressions if only one auth screen is migrated.
- Accessibility regressions if aria wiring is incomplete.

## Exit Criteria

1. Login and sign-up UI follows this plan without one-off layout overrides.
2. Shared primitives are reused instead of duplicating inline class strings.
3. QA checklist passes on desktop and mobile breakpoints.
