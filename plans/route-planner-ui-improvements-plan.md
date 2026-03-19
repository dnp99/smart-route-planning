# Route Planner UI Improvements Execution Plan

## Status

- Closed
- Last updated: 2026-03-19

## Objective

Polish the Route Planner page based on a UX review of the live optimized route output.
All changes are frontend-only (`frontend/src/components/RoutePlanner.tsx`).
No backend or shared contract changes required.

## Items

### 1. Replace "overlap pair(s) detected" with meaningful copy

**Current behaviour:** A red `<p>` reads "51 overlap pair(s) detected." — technical jargon
that means nothing to a nurse and reads as an alarming error even when the route is fine.

**Target behaviour:**
- If `overlappingVisitPairCount > 0`, show: "X patients share overlapping preferred windows — the optimizer will do its best to keep everyone on time."
- Use amber (warning) styling, not red (error) styling.
- If `overlappingVisitPairCount === 0`, show nothing (current behaviour).

**Files:** `RoutePlanner.tsx` — two occurrences of `{overlappingVisitPairCount} overlap pair(s) detected.`

---

### 2. Show time window inline on collapsed stop cards

**Current behaviour:** The preferred window (`windowStart`–`windowEnd`) is only visible
after expanding a stop card (clicking the patient name button). At a glance the nurse cannot
tell when a patient's window is or whether the scheduled time is close to it.

**Target behaviour:**
On every collapsed stop card, below the "Expected start time" line, show:
- If the task has a window: `Window: HH:MM – HH:MM`
- If no window: nothing (no change to current empty-window appearance)

The window is already available on `task.windowStart` / `task.windowEnd` and is already
rendered in the expanded section. This change only moves/copies it up to the collapsed view.

**Files:** `RoutePlanner.tsx` — the collapsed task card block (around line 1584–1602).

---

### 3. Color-code stop cards by scheduling status

**Current behaviour:** All 12 stop cards look identical regardless of whether a patient
is on time, running close to their window, or late.

**Target behaviour:** Add a 2px left border accent to each stop card:
- **Green** (`border-l-emerald-500`) — on time (`task.onTime === true`)
- **Amber** (`border-l-amber-400`) — on time but close to window close
  (slack < 30 min: `task.windowEnd` exists and `serviceEndTime` is within 30 min of window end)
- **Red** (`border-l-red-500`) — late (`task.lateBySeconds > 0`)
- No border accent — no preferred window (`!task.windowStart`)

The `lateBySeconds` and `onTime` fields are already on every `TaskResultV2` response object.
Slack can be computed client-side as `timeToMinutes(task.windowEnd) - serviceEndMinutes`.

**Files:** `RoutePlanner.tsx` — stop card `className` around line 1567.

---

### 4. Fix "Suggested leave-by" supporting copy

**Current behaviour:**
> "Based on the first planned visit (John Dunn) and a 18 min drive from the starting point."

John Dunn has no preferred window. He appears first only because he was on the way.
The departure time was actually anchored to tight-window patients (Gary, Shirley).
The message misleads the nurse into thinking John Dunn is the scheduling constraint.

**Target behaviour:** Change copy to reflect that departure is based on travel time to
the first stop — drop the patient-name reference entirely:
> "Based on a {travelDurationLabel} drive to your first visit."

The `leaveBySuggestion.firstPatientName` value used in the template can be removed.
`leaveBySuggestion.travelDurationLabel` is already computed and available.

**Current status (Mar 19, 2026):** The leave-by UI block is temporarily hidden from the route summary. The underlying route data and timing logic remain intact for future re-enable.

**Files:** `RoutePlanner.tsx` — the `leaveBySuggestion` banner around line 1411–1415.

---

### 5. Rename metric label "Estimated Time" → "Driving Time"

**Current behaviour:** The metric card reads "Estimated Time / 1 hr 42 min / Excludes live
traffic adjustments". The value is `totalDurationSeconds` (pure driving time). The nurse's
actual day runs from 8:10 AM to 2:17 PM (~6 hours), so "Estimated Time" is misleading.

**Target behaviour:**
- Label: `Driving Time` (was `Estimated Time`)
- Sub-label: `Total driving time, excludes traffic` (was `Excludes live traffic adjustments`)

No data change — same `totalDurationSeconds` value.

**Files:** `RoutePlanner.tsx` — around lines 1397–1405.

---

### 6. Collapse the selected-patients input list after optimization

**Current behaviour:** After optimization, both the pre-optimization "Selected destination
patients" list (original add order) and the post-optimization stop list (route order) are
visible simultaneously. Two competing numbered lists confuse the nurse about which order
matters.

**Target behaviour:** When a result exists (`result !== null`), collapse the "Selected
destination patients" section to a single summary line:
> "12 patients selected — [Edit]"

Clicking "Edit" re-expands the section so the nurse can add/remove patients and re-optimize.
The summary line replaces the full patient list while the result is displayed.

**Implementation note:** A boolean state `isDestinationListExpanded` (default `true`,
set to `false` when result arrives) controls the collapsed/expanded rendering. The "Edit"
link sets it back to `true`.

**Files:** `RoutePlanner.tsx` — the "Selected destination patients" section (around line 1200–1330).

---

### 7. Show service duration in collapsed stop card

**Current behaviour:** Visit duration (`serviceDurationMinutes`) is only shown in the
expanded details section. The nurse cannot see at a glance how long each stop will take.

**Target behaviour:** In the collapsed stop card, add duration inline with the travel
details line:
> `2.75 km · 7 min from previous stop · 20 min visit`

`task.serviceDurationMinutes` is already available on the task object.
`formatVisitDurationMinutes` is already implemented in the file.

**Files:** `RoutePlanner.tsx` — around line 1621–1625 (the distance/duration `<p>` tag).

---

### 8. Change "Optimize Route" to "Re-optimize Route" after first run

**Current behaviour:** The button always reads "Optimize Route" (or "Optimizing..." while
loading). After a result is shown, clicking it again re-runs optimization but the label
doesn't reflect that.

**Target behaviour:**
- No result yet → "Optimize Route"
- Result exists, not loading → "Re-optimize Route"
- Loading → "Optimizing..." (unchanged)

`result` is already in scope at the button render site.

**Files:** `RoutePlanner.tsx` — around line 1326.

---

## Implementation order

| # | Item | Effort | Risk |
|---|------|--------|------|
| 5 | Rename "Estimated Time" → "Driving Time" | Trivial | None |
| 4 | Fix leave-by copy | Trivial | None |
| 8 | Re-optimize button label | Trivial | None |
| 7 | Service duration on collapsed card | Low | None |
| 2 | Time window on collapsed card | Low | None |
| 1 | Replace overlap pair copy | Low | None |
| 3 | Color-code stop cards | Low | None |
| 6 | Collapse selected-patients list | Moderate | State interaction with re-optimize flow |

Suggested order: 5 → 4 → 8 → 7 → 2 → 1 → 3 → 6

---

## Acceptance criteria

- [x] "X overlap pair(s) detected." no longer appears anywhere on the page
- [x] Preferred window visible on every stop card without expanding
- [x] Stop cards have a green/amber/red left border accent reflecting scheduling status
- [x] Leave-by banner no longer names the first patient
- [x] Leave-by summary card is temporarily hidden (feature-flag style product decision)
- [x] Metric label reads "Driving Time"
- [x] "Selected destination patients" collapses to a summary line when a result is shown
- [x] Service duration visible on collapsed stop card
- [x] Button reads "Re-optimize Route" when a result already exists
