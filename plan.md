# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/plan.md` - implementation history and completed change log
- `plans/google-routes-phase-1-plan.md` - upcoming Phase 1 Google Routes migration plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Removed the analytics feature end-to-end from backend, frontend, and docs.

### Files added/updated/deleted
- Updated:
  - `backend/src/app/api/optimize-route/route.ts`
  - `backend/src/app/api/address-autocomplete/route.ts`
  - `frontend/src/components/RoutePlanner.tsx`
  - `README.md`
  - `backend/README.md`
  - `plans/plan.md`
- Deleted:
  - `backend/src/app/api/analytics/route.ts`
  - `backend/src/lib/analytics.ts`
  - `frontend/src/components/AdminDebugPanel.tsx`

### Why
Analytics was intentionally removed to simplify the app surface and eliminate unused endpoint/UI maintenance.

### Verification
- `backend`: `npm run lint`, `npm run build` ✅
- `frontend`: `npm run lint`, `npm run build` ✅
- repo-wide analytics-reference search returned no matches ✅

For full implementation details, see `plans/plan.md` section **31) Remove Analytics Feature**.
