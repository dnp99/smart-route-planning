# Mobile Route Planner UX Improvement Plan

## Problem Statement

The current mobile experience for the Smart Route Planner has two compounding issues that create dead ends and confusion:

### Issue 1 — "Continue" button disappears when sections are collapsed

The "Continue to Patients" button lives **inside** the Trip setup card. When the card is collapsed (showing the summary line like "3361 Ingram Road → 3361 Ingram Road — Edit"), the button is hidden. The user is stuck with no visible action to move forward.

The same applies in the Patients tab: "Continue to Review" only renders when `SelectedDestinationsSection` is expanded.

### Issue 2 — Two competing navigation paradigms

The UI has both:
- A tab bar at the top (`Trip | Patients | Review`) — implies free navigation between steps
- Collapsible sections within each tab — implies linear guided flow with Continue buttons

These conflict. The tab bar lets users jump freely, but the content within teaches them to click "Continue" to advance. The result is a confusing hybrid that does neither cleanly.

### Issue 3 — No visible progress or forward momentum cue

On a fresh visit, the user sees collapsed summaries with no obvious "what do I do next?" The step tabs are small and not clearly ordered. There's no step number or completion state.

---

## Goals

1. Users can always see how to proceed at any point — no dead ends
2. The navigation model is internally consistent: one clear pattern
3. The flow feels guided and linear on mobile, with clear forward momentum
4. Minimal regressions to desktop behavior (desktop can stay as-is)

---

## Proposed Approach: Step Wizard with Sticky Footer CTA

Transform the mobile experience into a clean **3-step wizard** while keeping the desktop layout unchanged.

### Core changes

#### 1. Sticky bottom CTA always visible

A sticky footer bar is always present on mobile for the active step, showing the primary action:

| Active step | CTA text | Enabled when |
|-------------|----------|--------------|
| Trip        | "Continue to Patients →" | start + end address filled |
| Patients    | "Continue to Review →"   | ≥1 patient selected |
| Review      | "Optimize Route"         | always (canOptimize) |

The CTA lives **outside** all collapsible sections. It never disappears.

If the step isn't complete yet, the button is disabled with a short helper line explaining what's needed (e.g., "Add a starting and ending point to continue").

#### 2. Remove collapsible sections from mobile steps entirely

On mobile, each tab shows its content **fully expanded** — no collapse/expand toggles. The collapsed summary cards were only useful as a visual compression, but they cause the proceed-button disappearance bug. Remove them on mobile:

- Trip tab: Always show the full Trip setup form
- Patients tab: Always show the patient search + full selected patients list
- Review tab: Already works cleanly (just shows the summary + Optimize button)

Desktop keeps the current collapse behavior unchanged.

#### 3. Step indicator showing progress

Replace the bare tab labels with a step indicator that shows:
- Current step number ("Step 1 of 3")
- Completion checkmarks for done steps
- Forward-only visual design (not a free-nav tab bar)

Tapping a previous step should still be allowed (to go back and edit), but the visual emphasis is on forward movement.

Implementation: add step number badges and a completion state to the existing tab buttons. The tab buttons stay clickable for back-navigation.

#### 4. Patients step: search + selected list always co-visible

Currently the search section and the selected-patients section can each be independently collapsed, creating a complex state machine. On mobile:

- Show the search input at the top
- Show selected patients below in a compact list (not expandable by default)
- "Edit window" for each patient opens an inline drawer or a bottom sheet, not an in-place expand

This reduces the number of expand/collapse states from 3 to 0 on mobile.

---

## Detailed Component Changes

### `RoutePlanner.tsx`

**Mobile sticky footer (new)**

Add a `mobileStepFooter` section after the form, always rendered on mobile, controlled by `activeMobileStep`:

```
{isMobileViewport && (
  <div className={responsiveStyles.stickyFooter}>
    <MobileStepCTA
      step={activeMobileStep}
      canProceedFromTrip={hasValidTripAddresses}
      canProceedFromPatients={selectedDestinations.length > 0}
      canOptimize={canOptimize}
      isLoading={isLoading}
      onContinueToPatients={() => setActiveMobileStep("patients")}
      onContinueToReview={() => setActiveMobileStep("review")}
      onSubmit={handleSubmit}
    />
  </div>
)}
```

**Remove mobile-only Continue buttons from inside sections** (lines 713–721 in RoutePlanner.tsx and line 255–262 in SelectedDestinationsSection.tsx)

**Remove mobile collapse toggles for trip and patients sections**

On mobile (`isMobileViewport`), skip rendering the collapse/expand chevron buttons and the collapsed summary cards. Always render the full section content. The guard conditions become:

```
{isTripStepVisible && (isTripSetupExpanded || isMobileViewport) && (
  // full trip form
)}
```

**Update step tab buttons to show completion state**

```tsx
const stepCompletionState = {
  trip: hasValidTripAddresses,
  patients: selectedDestinations.length > 0,
  review: true,
};
```

Add a checkmark icon or colored dot to completed steps in the tab bar.

### `SelectedDestinationsSection.tsx`

- Remove the `onContinueToReview` prop usage (CTA moves to sticky footer)
- On mobile, remove the `onCollapse` chevron
- Keep the component otherwise unchanged

### New `MobileStepCTA.tsx` (or inline in RoutePlanner)

A small component for the sticky step CTA:
- Renders the right button text and handler for the active step
- Shows a disabled state with helper text when not ready to proceed
- Visually matches the existing `secondaryButton` / `optimize-route-button` styles

---

## What stays the same

- Desktop layout: all collapsible sections unchanged, no sticky footer
- Route optimization logic: untouched
- Review step: no changes needed beyond receiving the sticky CTA
- Step tab bar: stays in place, just gets completion state indicators

---

## Implementation order

1. **Add sticky footer CTA** — pulls the continue/optimize buttons out of collapsible sections. Biggest unblock, safest change.
2. **Remove mobile collapse toggles** — simplify the expand/collapse state machine on mobile. Remove the summary-collapsed view on mobile.
3. **Step completion indicators** — visual polish on the tab bar.
4. **Patients step simplification** — remove the independent collapse for patient search vs selected list on mobile (optional, lower priority).

---

## Files to change

- `frontend/src/components/RoutePlanner.tsx` — main changes
- `frontend/src/components/routePlanner/SelectedDestinationsSection.tsx` — remove continue button + mobile collapse toggle
- `frontend/src/components/routePlanner/routePlannerStyles.ts` (or wherever `responsiveStyles` is defined) — add `mobileStepCTA` style
- Possibly a new `frontend/src/components/routePlanner/MobileStepCTA.tsx`

---

## Open questions

- Should tapping a completed step tab (e.g., Trip) collapse back to a summary, or always show the full form? Recommendation: always show full form on mobile for consistency.
- Should the step indicator use numbers (1/2/3) or just check/incomplete icons? Recommendation: numbered ("1 Trip", "2 Patients", "3 Review") with checkmark overlay on complete.
- On the Patients tab, when no patients are selected yet, should the "Continue" CTA be visible but disabled, or hidden? Recommendation: visible but disabled with helper text "Add at least one patient to continue."
