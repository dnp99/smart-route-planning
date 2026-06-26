# Session Auth Hardening Plan

## Context

Routefy uses DB-backed sessions (opaque session UUID in an httpOnly cookie, validated against the `auth_sessions` table on every request). The model is sound, but three gaps weaken it for a PHI/healthcare app:

1. **No idle timeout.** `expiresAt` is set once to `now + 24h` ([sessionRepository.ts:7](backend/src/lib/auth/sessionRepository.ts#L7), [sessionCookie.ts:2](backend/src/lib/auth/sessionCookie.ts#L2)) and never extended. A session lives a fixed 24h regardless of activity — too long for PHI, and with no inactivity expiry an unattended session stays valid all day.
2. **Password change doesn't revoke other sessions.** [update-password/route.ts:87](backend/src/app/api/auth/update-password/route.ts#L87) updates the hash but leaves every other session active, so a reset can't lock out a compromised device.
3. **Session table doubles as a forensic record.** Revoked rows are retained 30 days ([sessionRepository.ts:97](backend/src/lib/auth/sessionRepository.ts#L97)); fine only if a *separate* retained audit log is the real access record.

This plan adds a **dual timeout** (sliding idle + absolute cap), **sibling-session revocation on password change**, and **tightens retention** once the audit log is confirmed as the system of record.

**No DB schema migration is required** — `expiresAt`, `createdAt`, `revokedAt`, `lastSeenAt` already exist on `auth_sessions` ([schema.ts](backend/src/db/schema.ts)). Only their semantics/usage change.

## Goals / Non-goals

- **Goals:** idle timeout (~30 min) + absolute cap (~12 h); throttled sliding so it doesn't write on every request; log-out-everywhere on password change; shorter, well-justified session retention.
- **Non-goals (note, don't build now):** a user-facing "active sessions / log out everywhere" UI; concurrent-session caps; moving the auth audit log into Postgres. Flag these as follow-ups.

## Current state (grounded)

- `getSessionMaxAgeSeconds()` (24h) feeds **both** the cookie `Max-Age` and the DB `expiresAt` ([sessionCookie.ts:9](backend/src/lib/auth/sessionCookie.ts#L9), [sessionRepository.ts:8](backend/src/lib/auth/sessionRepository.ts#L8)).
- `findValidSessionWithNurse()` validates `revokedAt IS NULL AND expiresAt > now` ([sessionRepository.ts:38](backend/src/lib/auth/sessionRepository.ts#L38)) and returns only `{ sessionId, nurseId, email, isActive }`.
- `touchAuthSession()` updates **only** `lastSeenAt` and is called **only** in `/me` (GET + PATCH) — not in `requireAuth`, so other protected routes (optimize-route, patients, dashboard) never record activity.
- `requireAuth()` ([requireAuth.ts:11](backend/src/lib/auth/requireAuth.ts#L11)) is the one chokepoint every protected route goes through — the right place to slide expiry.

## Implementation

### Phase 1 — Dual timeout (idle + absolute)

**Semantic change:** `expiresAt` becomes the **idle deadline**. Validation (`expiresAt > now`) is unchanged, so it now enforces inactivity automatically. The **absolute** cap is enforced by never extending past `createdAt + absolute`.

1. **Config** — in [sessionCookie.ts](backend/src/lib/auth/sessionCookie.ts), replace the single `SESSION_MAX_AGE_SECONDS` with:
   - `SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60`
   - `SESSION_ABSOLUTE_TIMEOUT_SECONDS = 12 * 60 * 60`
   - `SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS = 60` (skip the sliding write if `lastSeenAt` is newer than this)
   - Export getters for each. Cookie `Max-Age` → `SESSION_ABSOLUTE_TIMEOUT_SECONDS` (browser keeps the cookie up to the hard cap; the server enforces idle via `expiresAt`). Update `buildSessionCookie`/`buildClearedSessionCookie` accordingly.

2. **Creation** — `createAuthSession()` sets `expiresAt = now + idle` (the `toExpiryDate` helper switches from max-age to idle timeout). `createdAt` (already defaulted) anchors the absolute cap.

3. **Sliding on activity** — fold into `requireAuth()`:
   - Extend `findValidSessionWithNurse()` to also return `createdAt`, `expiresAt`, `lastSeenAt`.
   - Add `extendAuthSessionActivity(sessionId, { now, createdAt })` to [sessionRepository.ts](backend/src/lib/auth/sessionRepository.ts):
     `newExpiry = min(now + idle, createdAt + absolute)`; `UPDATE set expiresAt = newExpiry, lastSeenAt = now`.
   - In `requireAuth`, after a valid lookup, call it **only if** `now - lastSeenAt >= SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS` → caps writes at ~1/min/session (avoids a write per request).
   - Remove the now-redundant `touchAuthSession` calls in `/me` (sliding in `requireAuth` already records activity); keep the function only if still referenced.

   Result: active use keeps a session alive in 30-min idle windows up to a 12-h hard ceiling, then forces re-login.

### Phase 2 — Revoke sibling sessions on password change

1. Add `revokeOtherAuthSessionsForNurse(nurseId, exceptSessionId, now = new Date())` to [sessionRepository.ts](backend/src/lib/auth/sessionRepository.ts):
   `UPDATE auth_sessions SET revokedAt = now, lastSeenAt = now WHERE nurseId = ? AND id <> exceptSessionId AND revokedAt IS NULL`.
2. Call it in [update-password/route.ts](backend/src/app/api/auth/update-password/route.ts) right after `updateNursePasswordHash` succeeds (line 87), passing `auth.nurseId` and `auth.sessionId` — keeps the current device signed in, logs out all others.
   - Index already exists (`auth_sessions_nurse_id_idx`), so the update is cheap.

### Phase 3 — Tighten retention (after confirming the audit log)

1. **Verify** the auth audit log ([auditLogger.ts](backend/src/lib/auth/auditLogger.ts), `console.info` JSON) is shipped to a **retained** sink (Vercel Log Drain / external SIEM). If it isn't, that's a prerequisite follow-up (persist auth events) — note it; don't silently shorten retention without it.
2. Once confirmed, lower the `cleanupAuthSessions` default `revokedRetentionDays` from 30 → **14** ([sessionRepository.ts:97](backend/src/lib/auth/sessionRepository.ts#L97)); expired rows are already purged immediately. `SESSION_CLEANUP_REVOKED_RETENTION_DAYS` env override stays.
   - Depends on the separate cron-auth fix (the route must actually run — see the `CRON_SECRET` change) or this has no effect.

## Risks / edge cases

- **Existing sessions on deploy:** rows created under the old 24h absolute model have `createdAt` possibly >12h ago. On their next request, `min(now+idle, createdAt+12h)` may be in the past → they expire and re-login once. Acceptable (it's the security win landing). Call it out in the release note; no grandfathering needed.
- **Write amplification:** mitigated by the 60s throttle — without it, every API call would `UPDATE` the session row.
- **Clock:** all timestamps are server-side; no client trust.
- **`SameSite=None` in prod** is required for the cross-site cookie and unchanged here.

## Testing / verification

- **Unit (vitest, backend):**
  - `extendAuthSessionActivity`: extends within window; **never exceeds** `createdAt + absolute`; is a no-op-ish when throttled (assert `requireAuth` skips the write when `lastSeenAt` is fresh).
  - Idle expiry: a session with `expiresAt < now` is rejected by `findValidSessionWithNurse`.
  - `revokeOtherAuthSessionsForNurse`: revokes siblings, **preserves** the current session, ignores already-revoked rows.
  - update-password route: asserts sibling revocation is invoked with `(nurseId, currentSessionId)` after a successful change; not invoked on a wrong-current-password 403.
  - Retention default = 14 in `cleanupAuthSessions`.
- **Manual e2e (preview):** log in on two browsers → change password on one → the other gets 401 on its next call. Leave a session idle past 30 min → next request 401. Keep clicking for >12 h (or temporarily shrink the absolute constant in a test) → forced re-login at the cap.
- **Pre-push (mandatory):** from `frontend/` run `npm run lint` and `npm run test`; from `backend/` run `npm run lint` (eslint + es-compat — avoid `Array/String.includes`, use `.some`/`.indexOf`) and `vitest run`.

## Rollout

- No DB migration. Ship Phases 1–2 together; Phase 3 only after the audit-log sink is confirmed and the session-cleanup cron is verified running (200, not 401).
- Tunable later via the new constants (idle 15–30 min, absolute 8–12 h) without schema changes.
