# Session Auth Hardening Plan

## Context

Routefy uses DB-backed sessions (opaque session UUID in an httpOnly cookie, validated against the `auth_sessions` table on every request). The model is sound, but three gaps weaken it for a PHI/healthcare app:

1. **No idle timeout.** `expiresAt` is set once to `now + 24h` ([sessionRepository.ts:7](backend/src/lib/auth/sessionRepository.ts#L7), [sessionCookie.ts:2](backend/src/lib/auth/sessionCookie.ts#L2)) and never extended. A session lives a fixed 24h regardless of activity — too long for PHI, and with no inactivity expiry an unattended session stays valid all day.
2. **Password change doesn't revoke other sessions.** [update-password/route.ts:87](backend/src/app/api/auth/update-password/route.ts#L87) updates the hash but leaves every other session active, so a reset can't lock out a compromised device.
3. **Session table doubles as a forensic record.** Revoked rows are retained 30 days ([sessionRepository.ts:97](backend/src/lib/auth/sessionRepository.ts#L97)); fine only if a *separate* retained audit log is the real access record.

This plan adds a **dual timeout** (sliding idle + absolute cap), **sibling-session revocation on password change**, **persists auth events to a durable audit log**, and only then **tightens session retention**. The retention cut is deliberately gated: today login/logout history lives durably *only* in the session rows, so shortening retention before auth events are persisted would destroy forensic evidence.

**No DB schema migration is required** — `expiresAt`, `createdAt`, `revokedAt`, `lastSeenAt` already exist on `auth_sessions` ([schema.ts](backend/src/db/schema.ts)). Only their semantics/usage change.

## Goals / Non-goals

- **Goals:** idle timeout (~30 min) + absolute cap (~12 h); throttled sliding so it doesn't write on every request; log-out-everywhere on password change; durable auth audit events; shorter, well-justified session retention.
- **Non-goals (note, don't build now):** a user-facing "active sessions / log out everywhere" UI; concurrent-session caps; shipping a Vercel Log Drain to an external SIEM. Flag these as follow-ups.

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

### Phase 3 — Persist auth audit events (prerequisite for Phase 4)

Today there are **two** audit loggers, and only one is durable:
- `lib/audit/auditLogger.ts` → `logAuditEvent()` **inserts into the `audit_events` table** ([schema.ts:398](backend/src/db/schema.ts#L398)) — used everywhere for PHI access (patients, optimize-route, visit-instances, dashboard).
- `lib/auth/auditLogger.ts` → `logAuthAuditEvent()` only does `console.info` ([auditLogger.ts](backend/src/lib/auth/auditLogger.ts)) — **ephemeral**, and no Log Drain is configured. So login/logout history lives durably **only** in the session rows themselves.

This phase makes auth events durable so the session table stops being the de-facto login-forensics record:

1. Route auth events into the existing `audit_events` table by reusing `logAuditEvent` (don't invent a new sink). For each login/logout/password-change, write a row with:
   - `action`: `auth.login` / `auth.logout` / `auth.password_change`
   - `resourceType`: `auth_session`, `resourceId`: the session id
   - `outcome`: success / invalid_credentials / rate_limited / etc.
   - `actorNurseId`: set on success (null on failed/unknown-account attempts — column is nullable)
   - `ipAddress`, `userAgent`; attempted email (masked) in `metadata`
2. Call it from the login, logout, and update-password routes. Keep the existing `console.info` line too if you still want it for live tailing — it's the *durability* that was missing, not the log line.
3. Confirm `audit_events` retention itself meets your compliance window (it's the long-lived record now); it is **not** touched by `cleanupAuthSessions`.

> Out of scope but adjacent: shipping a Vercel **Log Drain** to an external SIEM would also satisfy "retained sink." Persisting to `audit_events` is the lower-effort path since the table + writer already exist.

### Phase 4 — Tighten retention (depends on Phase 3 + cron running)

Only after Phase 3 lands (auth history is durable) **and** the cleanup cron is confirmed running (the `CRON_SECRET` fix — a 401 cron deletes nothing):

1. Lower the `cleanupAuthSessions` default `revokedRetentionDays` from 30 → **14** ([sessionRepository.ts:97](backend/src/lib/auth/sessionRepository.ts#L97)). Expired rows are already purged immediately; this only shortens how long *revoked* rows linger. `SESSION_CLEANUP_REVOKED_RETENTION_DAYS` env override stays.
2. Rationale: once login forensics live in `audit_events`, session rows carry no unique evidence, so a shorter window is pure data-minimization upside (less stale IP/device PII in the hot table).

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
  - **Phase 3:** login/logout/password-change routes write an `audit_events` row with the expected `action`/`outcome`/`actorNurseId` (mock the `logAuditEvent` writer and assert the payload; failed-login case has null `actorNurseId`).
  - **Phase 4:** retention default = 14 in `cleanupAuthSessions`.
- **Manual e2e (preview):** log in on two browsers → change password on one → the other gets 401 on its next call. Leave a session idle past 30 min → next request 401. Keep clicking for >12 h (or temporarily shrink the absolute constant in a test) → forced re-login at the cap.
- **Pre-push (mandatory):** from `frontend/` run `npm run lint` and `npm run test`; from `backend/` run `npm run lint` (eslint + es-compat — avoid `Array/String.includes`, use `.some`/`.indexOf`) and `vitest run`.

## Rollout & dependencies

Ordering (Phases 1, 2, 3 are independent of each other; **Phase 4 depends on Phase 3 + the cron**):

```
Phase 1  idle/absolute timeout          ─┐
Phase 2  sibling revocation             ─┤ independent, ship anytime
Phase 3  persist auth events → audit_events ─┘
                                              │
CRON_SECRET fix (done, deploying) ────────────┤
                                              ▼
Phase 4  shorten retention 30 → 14   (only after Phase 3 AND a 200 cron run)
```

- **No DB migration** anywhere: `auth_sessions` columns all exist (Phases 1, 2, 4) and `audit_events` already exists (Phase 3).
- Suggested shipping order: Phases 1+2 together (the security wins), then Phase 3, then Phase 4 once the cron is verified `200`.
- Timeouts are tunable later via the new constants (idle 15–30 min, absolute 8–12 h) without schema changes.
