# Admin Dashboard — Design & Plan

Status: **Phase 1 complete. Phase 2 backend complete; Phase 2 frontend next.**
Admin UI location confirmed: same app, gated `/admin/*` route tree.

An internal admin surface for the app owner (data controller) to monitor and
manage nurse accounts: new signups, per-user activity (logins, clients added,
edits, route runs), and account actions (deactivate, reset password).

## Goals

- See **new users** (signups) and their lifecycle: first login, last active,
  active/inactive.
- See **what each nurse has done**: an activity feed sourced from the audit log
  (login, client create/update/archive/restore/delete, template CRUD, visit
  changes, route optimizations, advisor calls).
- **In-app KPIs**: signups over time, DAU/WAU, clients added, etc.
- **Admin actions**: deactivate/reactivate a nurse, reset a nurse's password.
- Everything an admin does — including **viewing PHI** — is itself audited.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Admin identity | **Separate admin auth** (own tables + sessions) | Full isolation from nurse auth; admins are a distinct user class. |
| PHI visibility | **Full detail** (patient names/addresses) | Admin is the data controller. Paired with mandatory admin-access auditing. |
| Analytics | **In-app only, no external pipeline** | Shipping full-PHI logs to external BI is an unacceptable exposure surface. Revisit only with de-identified export. |
| Admin access auditing | **Required from Phase 1** | Accountability for who viewed/changed what PHI. Non-negotiable. |
| Password reset | **Temp password + forced change** | No email infra exists; works today. Adds `mustChangePassword` flag on nurses. |
| Impersonation ("log in as") | **Out of v1** | Riskiest admin power (acting as a nurse over PHI, muddying the trail). Defer. |
| Admin UI location | **Separate `/admin/*` route tree in the same app** (default) | Simplest; own login + own session cookie. Separate deployment can come later if it grows. *(Confirm before Phase 2.)* |

## What already exists (reused, not rebuilt)

- **`audit_events`** table (`backend/src/db/schema.ts`) — actor, action, resourceType,
  resourceId, outcome, metadata (jsonb), ipAddress, userAgent, createdAt; indexed
  by actor+time and resource+time. Already populated by nearly every mutating
  endpoint: `login`, `patients.create/update/archive/restore/permanent_delete`,
  `recurring_templates.*`, `visit_instances.*`, `reschedule`, `skip`,
  `optimize.v3`, `route.advisor`, `dashboard.summary`.
- **`nurses`** — `createdAt` (signup time), `lastLoginAt`, `email`, `displayName`,
  `isActive`.
- **Auth primitives** — bcrypt `hashPassword`/`verifyPassword`
  (`lib/auth/password.ts`); opaque-id cookie sessions backed by `auth_sessions`
  + `requireAuth` (`lib/auth/requireAuth.ts`). The admin auth **mirrors** this.

### Gaps this plan closes
1. No **`signup`** audit event (only `login` is logged). Add one.
2. No **admin/role** concept anywhere. Add isolated admin auth.
3. Audit log can't attribute an action to an **admin** actor. Add `actorAdminId`.

## Data model changes

New tables (created via `db:generate`, never hand-written):

```
admins
  id            uuid pk default random
  email         text not null unique
  passwordHash  text not null
  displayName   text not null
  isActive      boolean not null default true
  lastLoginAt   timestamptz
  createdAt     timestamptz not null default now
  updatedAt     timestamptz not null default now

admin_sessions   (mirrors auth_sessions)
  id            text pk                 -- opaque session id (cookie value)
  adminId       uuid not null -> admins(id) on delete cascade
  expiresAt     timestamptz not null
  revokedAt     timestamptz
  lastSeenAt    timestamptz not null default now
  ipAddress     text
  userAgent     text
  deviceType    text not null default 'unknown'
  createdAt     timestamptz not null default now
```

Column additions:

```
audit_events.actorAdminId   uuid null -> admins(id) on delete set null
  -- one unified timeline; nurse actions keep actorNurseId, admin actions set actorAdminId.

nurses.mustChangePassword   boolean not null default false
  -- set true when an admin resets the password; nurse login blocks until changed.
```

## New audit actions

- On nurse registration: **`signup`** (actorNurseId, ip, ua).
- Admin actions (actorAdminId): **`admin.login`**, **`admin.logout`**,
  **`admin.patient.view`** (PHI access), **`admin.nurse.deactivate`** /
  **`admin.nurse.reactivate`**, **`admin.nurse.password_reset`**.

> PHI-view auditing: when the admin opens a nurse's full activity/detail that
> exposes patient names/addresses, record an `admin.patient.view` event with the
> viewed nurse/patient scope in metadata. Metadata never stores more PHI than the
> event already concerns.

## API surface

```
POST   /api/admin/auth/login       email + password -> admin session cookie
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
GET    /api/admin/nurses           list users: signup, last login, active, counts
GET    /api/admin/nurses/:id       one nurse + activity feed (full detail)
GET    /api/admin/metrics          in-app KPIs (signups, DAU/WAU, clients added)
POST   /api/admin/nurses/:id/deactivate      (audited)
POST   /api/admin/nurses/:id/reactivate      (audited)
POST   /api/admin/nurses/:id/reset-password  -> temp password (audited)
```

All admin routes behind `requireAdmin` (reads `routefy_admin_session` cookie,
resolves `admin_sessions` -> `admins`, rejects nurse sessions).

## Frontend

- Separate `/admin/*` route tree with its own login screen and admin session.
- Screens: **Login**, **Users** (table + KPIs), **User detail** (activity feed +
  action buttons).
- Styles per the design system (`responsiveStyles.ts` tokens; no inline Tailwind).

## Password reset flow (no email)

1. Admin clicks "Reset password" on a nurse → server generates a random temp
   password, sets `nurses.passwordHash` to its hash, sets `mustChangePassword =
   true`, writes `admin.nurse.password_reset`. Temp password returned **once** to
   the admin to relay out-of-band.
2. Nurse logs in with the temp password → login succeeds but, because
   `mustChangePassword` is true, the app forces a password change (via the
   existing `update-password` flow) before anything else.
3. Successful change clears `mustChangePassword`.

## Phasing & checklists

### Phase 1 — Foundation ✅ (done)
- [x] `schema.ts`: `admins`, `admin_sessions`, `audit_events.actorAdminId`,
      `nurses.mustChangePassword`. Migration `drizzle/0020_dapper_sugar_man.sql`.
- [x] `db:generate` + migrate (applied to the dev DB).
- [x] Admin session repo + `requireAdmin` guard + admin session cookie helpers
      (`src/lib/admin/`).
- [x] `/api/admin/auth/login|logout|me`.
- [x] First-admin seed script `backend/scripts/create-admin.mjs`
      (`npm run admin:create`).
- [x] Admin-audit helper `logAdminAuditEvent` (writes `actor_admin_id`).
- [x] `signup` audit event + durable `login` audit event (both now in DB).
- [x] Tests: admin login route, requireAdmin (rejects nurse sessions), cookie
      helpers, signup/login audit events.

### Phase 2 — Read dashboard
- [x] `GET /api/admin/nurses` (list + summary counts).
- [x] `GET /api/admin/nurses/:id` (profile + full patients + activity feed).
- [x] `GET /api/admin/metrics` (nurse totals, signups + 14-day trend, DAU/WAU,
      clients added).
- [x] `admin.nurse.view` auditing on the PHI-exposing detail read.
- [x] Backend tests: list/detail/metrics, incl. the PHI-view audit fires.
- [ ] Admin frontend (same app, `/admin/*`): login screen, users table + KPIs,
      user-detail (activity feed + full patient list). *(next)*
- [ ] Frontend tests.

### Phase 3 — Admin actions
- [ ] Deactivate / reactivate nurse (audited).
- [ ] Reset password: temp + `mustChangePassword`; enforce forced change at nurse
      login; clear on change.
- [ ] Tests: each action audited; forced-change gate at login.

### Phase 4 — Later / optional
- [ ] Richer analytics charts (trends, retention).
- [ ] Email provider → real self-service reset links.
- [ ] Impersonation (only with a hard audit trail) if a support need appears.

## Constraints & discipline

- **Migrations:** update `schema.ts` then `npm run db:generate` (never hand-write;
  never `drizzle-kit push`). See [`database-migrations.md`](database-migrations.md).
- **Styles:** all in `responsiveStyles.ts` first; no inline Tailwind.
- **View/logic separation:** `.tsx` stays view-only; logic in hooks/modules.
- **Pre-commit:** `npm run lint` + `npm run test` green (frontend and backend).
- Small, reviewable commits per phase. Never `git push`.

## Out of scope (v1)

- External analytics / BI export (PHI risk).
- Impersonation.
- Email-based password reset.
- Admin role tiers (all admins equal for now).
