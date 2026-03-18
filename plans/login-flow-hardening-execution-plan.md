# Login Flow Hardening Execution Plan

Date created: 2026-03-14
Last updated: 2026-03-17

## Status

Open.

This remains a planning/backlog document. It has not been marked completed in the repository change log yet.

## Objective

Harden the login flow with clear security controls and remove ambiguity around password transmission behavior between frontend and backend.

This is a planning-only document and should be treated as pending until explicitly closed out.

## Context

Current frontend login implementation posts:

- `email`
- `password`

to backend login endpoint as JSON in request body.

Repo evidence:

- FE login request: `frontend/src/components/auth/authService.ts`
- FE login form submit path: `frontend/src/components/auth/LoginPage.tsx`
- BE login handler: `backend/src/app/api/auth/login/route.ts`
- BE password verification: `backend/src/lib/auth/password.ts`

## Security Clarification (Important)

Sending the password in the request body is expected for username/password auth.

The security boundary is:

1. HTTPS/TLS protects the password in transit.
2. Backend hashes and verifies password using bcrypt.
3. Backend never stores plaintext passwords.

Do **not** add custom client-side password encryption as a substitute for TLS. It typically adds complexity without improving real security.

## Current Risks

1. Local/dev can still accidentally run on non-HTTPS origins (prod must not).
2. Login rate limiting is in-memory and not shared across instances.
3. JWT is client-managed bearer token (XSS impact should be considered).
4. Missing explicit operational checklist for transport and auth hardening.

## Target Outcome

After this work:

1. Production login is strictly HTTPS with secure headers and strict origin policy.
2. Login throttling works consistently in distributed deployments.
3. Credential handling and logging rules are explicit and enforced.
4. Team has a documented position: plaintext password in JSON is acceptable only over HTTPS.

## Scope

### In scope

- Transport hardening requirements for login.
- Backend login endpoint hardening controls.
- Rate-limit model upgrade plan for multi-instance deployments.
- Auth-token storage tradeoff decision and plan.
- Test and rollout checklist.

### Out of scope

- Replacing username/password with full WebAuthn-only auth in this phase.
- Re-architecting all auth screens beyond login/signup flow.
- Third-party IdP / SSO rollout.

## Recommended Plan

## Phase 1 - Transport and policy hardening (highest priority)

1. Enforce HTTPS in all production environments.
2. Ensure CORS allowlist is strict and environment-specific.
3. Add/verify HSTS and security headers at deployment edge/app layer.
4. Confirm no mixed-content or insecure-origin auth calls from frontend.

Deliverables:

- Deployment checklist update.
- Environment validation script/checklist for auth-critical vars.

## Phase 2 - Backend login hardening

1. Keep bcrypt verification flow (no plaintext persistence).
2. Ensure login payload and password are never logged.
3. Keep generic credential error messages (`Invalid email or password.`).
4. Add structured audit logs for login outcome (success/failure) without sensitive data.

Deliverables:

- Login route hardening changes in `backend/src/app/api/auth/login/route.ts`.
- Logging guardrails in backend docs and implementation.

## Phase 3 - Rate limiting and abuse protection

1. Replace in-memory login limiter with centralized store (e.g., Redis/Upstash).
2. Apply IP + account-keyed throttling strategy.
3. Add short lockout/backoff policy for repeated failures.
4. Optional: CAPTCHA challenge after repeated failures.

Deliverables:

- New shared rate-limit utility for auth endpoints.
- Integration tests for distributed-safe limit behavior.

## Phase 4 - Token/session model review

Decision checkpoint:

- Keep bearer token storage pattern, or
- move to HttpOnly secure cookie model.

Recommendation:

- If staying with bearer token, add stronger XSS controls and periodic token rotation.
- If moving to cookies, include CSRF protection strategy and same-site policy review.

Deliverables:

- ADR-style decision note with rationale.
- Migration plan (if cookie model is selected).

## Phase 5 - Validation and rollout

1. Add E2E auth smoke tests (login success/fail/rate-limit behavior).
2. Add security checklist to release process.
3. Run staged rollout and monitor auth failure/429 rates.

Success criteria:

1. No plaintext password persistence anywhere in logs or DB.
2. Login works under normal traffic and limits abuse reliably.
3. Prod login requests are HTTPS-only and CORS-compliant.

## Optional Future Direction (if requirement is "never send password as reusable secret")

If product/security requirements demand stronger guarantees than password-over-TLS:

1. Evaluate WebAuthn passkeys as primary auth.
2. Optionally evaluate PAKE-based protocols (higher complexity).

This should be treated as a separate roadmap item.

## Test Plan

### Backend

1. Unit tests for login guard behavior and redaction-safe logging.
2. Route tests for:
   - valid credentials -> 200
   - invalid credentials -> 401
   - rate-limited attempts -> 429
3. Security tests confirming no sensitive fields are emitted in responses/logs.

### Frontend

1. Login form integration tests (happy path and failures).
2. Verify API base URL and HTTPS-origin expectations for production builds.
3. Ensure user-facing errors remain generic and non-sensitive.

## Rollout Checklist

1. Confirm `ALLOWED_ORIGINS` is production-only allowed domains.
2. Confirm production endpoint is HTTPS and HSTS enabled.
3. Confirm JWT secret rotation policy exists.
4. Confirm centralized rate limiting enabled for auth endpoints.
5. Confirm monitoring dashboards include:
   - login success/failure rate
   - 429 rate
   - unusual origin/auth traffic patterns
