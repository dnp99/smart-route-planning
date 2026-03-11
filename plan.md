# Plan Index

The repository planning documents are stored under `plans/`.

Files:

- `plans/plan.md` - implementation history and completed change log
- `plans/google-routes-phase-1-plan.md` - upcoming Phase 1 Google Routes migration plan

This root file exists to preserve the repository convention that `plan.md` is updated alongside project changes.

## Latest change record

### Change
Implemented address-autocomplete modular refactor and introduced shared FE/BE API contracts with runtime validation helpers.

### Files added/updated/deleted
- Added:
  - `shared/contracts/common.ts`
  - `shared/contracts/optimizeRoute.ts`
  - `shared/contracts/addressAutocomplete.ts`
  - `shared/contracts/index.ts`
  - `backend/src/app/api/address-autocomplete/constants.ts`
  - `backend/src/app/api/address-autocomplete/validation.ts`
  - `backend/src/app/api/address-autocomplete/cacheAndRateLimit.ts`
  - `backend/src/app/api/address-autocomplete/googlePlacesClient.ts`
  - `backend/src/app/api/address-autocomplete/addressAutocompleteService.ts`
- Updated:
  - `backend/src/app/api/address-autocomplete/route.ts`
  - `backend/src/app/api/optimize-route/route.ts`
  - `backend/src/app/api/optimize-route/types.ts`
  - `backend/src/app/api/optimize-route/route.test.ts`
  - `backend/next.config.ts`
  - `backend/tsconfig.json`
  - `frontend/src/components/AddressAutocompleteInput.tsx`
  - `frontend/src/components/routePlanner/routePlannerService.ts`
  - `frontend/src/components/types.ts`
  - `frontend/vite.config.js`
  - `plan.md`
  - `plans/plan.md`

### Why
You asked for (1) `address-autocomplete` split into smaller modules and (2) shared contract validation/schema. This change keeps route handlers thin, centralizes API contract logic, and ensures frontend parsing and backend shaping use the same shared definitions.

### Verification
- `backend`: `npm run test:coverage` ✅ (100% statements/branches/functions/lines)
- `backend`: `npm run lint`, `npm run build` ✅
- `frontend`: `npm run test:coverage` ✅ (97.61% statements / 93.22% branches / 100% functions / 97.60% lines)
- `frontend`: `npm run lint`, `npm run build` ✅

For full implementation details, see `plans/plan.md` section **40) Address-Autocomplete Modular Refactor + Shared API Contracts**.

For full implementation details, see `plans/plan.md` section **33) Shared Backend HTTP/CORS/Error Helpers**.
