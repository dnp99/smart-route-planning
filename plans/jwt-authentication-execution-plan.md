# JWT Authentication Execution Plan

Date created: 2026-03-12
Last updated: 2026-03-17

## Status

Completed.

This file is retained as the original execution plan record.
For rollout completion and remediation details, see:

- `plans/jwt-authentication-remediation-release-note.md`

## Objective

Add user login and JWT authentication so:

1. users must log in before viewing any app data,
2. all backend business endpoints require a valid JWT,
3. data access is scoped to the authenticated user identity.

The plan in this document has been executed.

## User Requirements (locked)

- users must authenticate before seeing data in the frontend.
- all backend endpoints must be protected by JWT authentication.

## Current State (repo evidence)

- frontend routes are public (`/patients`, `/route-planner`) in `frontend/src/App.jsx`.
- patient ownership currently resolves through env-based default nurse context in `backend/src/lib/patients/nurseContext.ts`.
- there are no login/auth endpoints under `backend/src/app/api/` today.
- API routes currently exposed:
  - `POST /api/optimize-route`
  - `GET /api/address-autocomplete`
  - `GET/POST /api/patients`
  - `PATCH/DELETE /api/patients/:id`

## Target Outcome

After this phase:

- frontend requires authentication before rendering protected pages.
- backend protects all non-auth business endpoints with JWT verification.
- authenticated identity replaces env-based default nurse resolution for patient-scoped data.
- unauthorized requests return consistent `401` responses.

## Scope

### In scope

- user login endpoint and credential verification.
- JWT issuance and verification.
- backend auth guard utilities used by all protected routes.
- frontend auth state + login screen + route gating.
- automatic `Authorization: Bearer <token>` usage in frontend API calls.
- migration off `DEFAULT_NURSE_POC` identity resolution in request paths.
- tests for auth guard behavior and protected route behavior.

### Out of scope

- OAuth/social login.
- multi-factor authentication.
- role-based permission matrix beyond owner-scoped data.
- SSO / enterprise identity providers.

## Recommended Auth Model

## 1) Identity model

Use the existing `nurses` table as the authenticated user principal for this phase.

Why:

- `patients.nurse_id` already expresses per-user ownership.
- avoids high-risk migration from `nurse_id` to a brand-new `user_id` table in phase 1.
- meets requirement that each user must log in and see only their data.

Add auth fields to `nurses`:

- `email text unique not null`
- `password_hash text not null`
- optional hardening fields:
  - `is_active boolean not null default true`
  - `last_login_at timestamptz`

## 2) Password handling

- hash passwords with `bcrypt`/`bcryptjs` using a strong work factor (e.g., 12).
- never store or log plain-text passwords.
- seed at least one initial account for local/dev onboarding.

## 3) JWT strategy

- use signed JWT access tokens (HS256 with server secret).
- include claims:
  - `sub` = authenticated nurse/user id
  - `email`
  - `iat`, `exp`
- recommended access token TTL: 15-60 minutes.

Phase-1 simplification:

- stateless access token only (no refresh token) is acceptable for first delivery.
- if longer sessions are required later, add refresh-token flow as phase 2.

## 4) Token transport

- frontend stores JWT client-side and sends `Authorization: Bearer <token>`.
- backend validates token on each protected request.

Note:

- because frontend and backend are separate app origins in local/dev (`5173` and `3000`), bearer-header flow is lower-friction than cross-site cookie auth for this phase.

## API Plan

## New auth endpoints

1. `POST /api/auth/login`
   - request: `{ email, password }`
   - response: `{ token, user }` (user excludes password hash)
   - errors:
     - `400` invalid payload
     - `401` invalid credentials

2. `GET /api/auth/me`
   - requires JWT
   - returns current authenticated user profile

3. `POST /api/auth/logout` (optional phase-1 convenience)
   - stateless acknowledgement for frontend flow
   - client primarily clears local auth state/token

## Protected endpoints (must require JWT)

- `POST /api/optimize-route`
- `GET /api/address-autocomplete`
- `GET /api/patients`
- `POST /api/patients`
- `PATCH /api/patients/:id`
- `DELETE /api/patients/:id`

Preflight `OPTIONS` handlers remain unauthenticated for CORS compatibility.

## Backend Implementation Plan (phased)

## Phase A — Auth foundation

1. Add auth schema changes + migration for `nurses` auth fields.
2. Add shared auth contracts under `shared/contracts`:
   - login request/response types
   - authenticated user shape
3. Add auth utilities under `backend/src/lib/auth/`:
   - password verify helper
   - token sign/verify helper
   - auth context resolver (`requireAuth`)
4. Add auth env configuration:
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`

## Phase B — Auth endpoints

1. Add `backend/src/app/api/auth/login/route.ts`.
2. Add `backend/src/app/api/auth/me/route.ts`.
3. Add route tests for login/me success + failure paths.

## Phase C — Protect all business endpoints

1. Introduce `requireAuth(request)` guard usage in:
   - `backend/src/app/api/optimize-route/route.ts`
   - `backend/src/app/api/address-autocomplete/route.ts`
   - `backend/src/app/api/patients/route.ts`
   - `backend/src/app/api/patients/[id]/route.ts`
2. Replace `resolveNurseContext()` request-time usage with authenticated identity from JWT (`sub`).
3. Standardize unauthorized response shape/status (`401`).

## Phase D — Remove env-default identity dependency

1. Retire `DEFAULT_NURSE_POC`/`DEFAULT_NURSE_ID` from request authorization flow.
2. Keep any bootstrap seed utility only for account creation, not request identity.
3. Update backend README env docs accordingly.

## Frontend Implementation Plan (phased)

## Phase E — Auth UI and state

1. Add login page (e.g., `/login`).
2. Add auth state provider (token + current user).
3. Add protected route wrapper in router so `/patients` and `/route-planner` require auth.
4. Redirect unauthenticated users to `/login`.

## Phase F — Authenticated API client behavior

1. Centralize authenticated fetch helper used by:
   - `frontend/src/components/patients/patientService.ts`
   - `frontend/src/components/routePlanner/routePlannerService.ts`
   - `frontend/src/components/AddressAutocompleteInput.tsx` fetch path
2. Attach `Authorization` header for protected backend requests.
3. On `401`, clear auth state and redirect to `/login`.

## Security & Hardening Checklist

- keep `JWT_SECRET` out of client bundles and logs.
- short token lifetime and strict signature verification.
- reject malformed/expired JWTs with `401`.
- avoid leaking credential-validation detail in error messages.
- ensure password hashes are never returned in API responses.
- apply basic login endpoint rate limiting (reuse guard patterns from existing rate-limit modules).

## Testing Plan

## Backend tests

- unit tests:
  - password hashing/verification utilities
  - JWT sign/verify utilities
- route tests:
  - `POST /api/auth/login` (success, invalid credentials, malformed payload)
  - all protected endpoints return `401` without/with invalid token
  - protected endpoints succeed with valid token and proper data scoping

## Frontend tests

- auth provider + protected route behavior:
  - unauthenticated route access redirects to login
  - successful login unlocks protected routes
- service-layer tests ensure auth header is attached.
- `401` handling clears local auth and redirects.

## CI verification

- backend: `npm run lint`, `npm run test:coverage`, `npm run build`
- frontend: `npm run lint`, `npm run test:coverage`, `npm run build`

## Rollout Sequence

1. deliver backend auth foundation + login endpoint + tests.
2. add frontend login + route gating.
3. protect all backend business endpoints and migrate identity resolution.
4. run full regression tests and update docs.
5. remove deprecated default-nurse auth path.

## Risks and Mitigations

1. **Risk:** accidental lockout during migration.
   - **Mitigation:** seed known login account and add `/api/auth/login` integration tests before endpoint protection cutover.

2. **Risk:** frontend misses one API call without auth header.
   - **Mitigation:** centralized authenticated fetch wrapper and explicit tests for each service module.

3. **Risk:** token expiry UX friction.
   - **Mitigation:** clear `401` UX flow (session expired → login redirect). Add refresh-token flow in follow-up if needed.

4. **Risk:** residual env-based identity assumptions in backend.
   - **Mitigation:** explicit code search/removal checklist for `resolveNurseContext` usage.

## Done Criteria

- users cannot access `/patients` or `/route-planner` without login.
- all non-auth backend endpoints reject missing/invalid JWT with `401`.
- patient list and mutations are scoped to authenticated user id.
- existing CI quality gates pass with new auth coverage.
- documentation reflects final auth env vars and onboarding steps.
