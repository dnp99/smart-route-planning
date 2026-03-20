# PR Review Fixes Plan

Fixes for issues found in PR review of `feature/menu` → `main`.

## Issues to Fix

### 1. Restore removed `appRoutes.test.tsx` tests (blocking)

**What was removed:** 6 pre-existing tests were deleted to work around test contamination:
- "renders route planner at /route-planner and marks nav active"
- "prefills route planner start and end from saved home address"
- "capitalizes nurse display name in the workspace subtitle"
- "renders patients page at /patients and marks nav active"
- "shows account options menu items"
- "opens account settings modal and saves home address"

**Root cause:** The new Footer tests render `PatientsPage` with no `listPatients` mock. The unmocked `fetch` call is still in flight when `cleanup()` runs, and it resolves during the next test's rendering cycle, triggering an act() warning that fails the test.

**Fix:** Add a `listPatients` mock to `appRoutes.test.tsx` (same pattern used in `patientsRoutePlanner.integration.test.tsx`):

```ts
const { listPatientsMock } = vi.hoisted(() => ({
  listPatientsMock: vi.fn(),
}));

vi.mock("../components/patients/patientService", () => ({
  listPatients: listPatientsMock,
}));
```

In `beforeEach`, set a default resolved value:
```ts
listPatientsMock.mockResolvedValue([]);
```

Then restore the 6 removed tests (copy from `main` branch via `git show main:frontend/src/tests/appRoutes.test.tsx`).

Also remove the 3rd Footer test ("footer legal links point to correct routes") that was also removed — restore it too since the mock will fix contamination.

---

### 2. Remove `windowType` from `hasChangedSinceLastOptimize` snapshot (non-blocking)

**File:** `frontend/src/components/RoutePlanner.tsx` ~line 329

**Current:**
```ts
.map((d) => `${d.visitKey}:${d.windowStart}:${d.windowEnd}:${d.windowType ?? ""}`)
```

**Fix:**
```ts
.map((d) => `${d.visitKey}:${d.windowStart}:${d.windowEnd}`)
```

`windowType` is a stored property, not user-editable in the planner. Only `windowStart` and `windowEnd` are changed via the time inputs, so only they need to invalidate the snapshot.

---

### 3. Remove double blank line in App.jsx (nit)

**File:** `frontend/src/App.jsx` — the double blank line after the closing `</div>` of the header row, before `{isAuthenticated && (`.

---

## Order of Work

1. Fix `appRoutes.test.tsx` (most effort — restore 7 tests + add mock)
2. Fix snapshot (`windowType` removal — 1 line)
3. Fix blank line (trivial)
4. Run full test suite to confirm all 111+ tests pass
5. Commit and push

## Files to Touch

- `frontend/src/tests/appRoutes.test.tsx`
- `frontend/src/components/RoutePlanner.tsx`
- `frontend/src/App.jsx`
