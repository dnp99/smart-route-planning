# Shared Select Migration Plan (shadcn-style)

## Goal

Create a shared dropdown/select component and migrate UI usage from native `<select>` to a consistent, accessible, reusable component system.

## Scope

- Frontend-only migration.
- No backend/API contract changes.
- Incremental rollout to reduce regression risk.

## Phase 1 — Discovery and Audit

1. Find all native `<select>` usage in frontend.
2. Categorize by context:
   - Page forms
   - Modal/dialog forms
   - Compact/table controls
   - Mobile-specific surfaces
3. Flag risky contexts (scroll containers, overflow clipping, nested modals).

## Phase 2 — Component Contract

1. Define shared API:
   - `value`
   - `onValueChange`
   - `placeholder`
   - `disabled`
   - `label`
   - `error`
   - `helperText`
2. Standardize controlled-component usage with current form state patterns.
3. Define size variants (default, compact) and error state behavior.

## Phase 3 — Shared Component Build

1. Create component(s) under `frontend/src/components/shared`.
2. Implement shadcn-style composition pattern.
3. Support accessibility requirements:
   - keyboard navigation
   - focus visibility
   - ARIA labeling
4. Decide portal strategy for modal compatibility.

## Phase 4 — Pilot Migration

1. Migrate one low-risk dropdown first (recommended: Route Planner template filter).
2. Validate:
   - keyboard interactions
   - visual consistency
   - modal/overlay stacking
   - mobile behavior

## Phase 5 — Core Form Migration

1. Migrate patient form dropdowns (visit type, weekday/day selectors).
2. Verify behavior inside modal surfaces:
   - clipping/overflow
   - focus trap compatibility
   - scroll positioning

## Phase 6 — App-wide Rollout

1. Replace remaining native selects feature-by-feature.
2. Keep migration PRs small and focused.
3. Run FE validation for each rollout slice:
   - `npm run lint`
   - `npm run test`
   - `npm run build`

## Phase 7 — Testing and Hardening

1. Add/adjust tests for:
   - value selection flows
   - keyboard selection and close behavior
   - modal rendering and focus behavior
2. Add regression checks for existing forms and route planner workflows.

## Phase 8 — Cleanup and Standards

1. Remove duplicated local select styling patterns after migration.
2. Document usage guideline:
   - default to shared select component
   - use native `<select>` only by explicit exception (e.g., platform fallback)
3. Optional: add lint/custom check to discourage new raw `<select>` usage.

## Acceptance Criteria

1. Shared select component exists and is used in all planned migrated surfaces.
2. Accessibility baseline (keyboard/focus/labels) is preserved or improved.
3. Modal and mobile interactions are stable.
4. Full frontend lint/test/build passes after final migration.
