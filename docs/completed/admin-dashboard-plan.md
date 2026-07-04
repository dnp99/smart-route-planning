# Admin Dashboard — Design & Plan

Status: **Shipped and in use.** Phases 1–3 complete; Phase 4 analytics/metrics
done, plus post-plan polish (per-nurse route-run history, client table
pagination + search + sort, confirm dialogs on actions, repository test
coverage). All verified end-to-end against the running server. Only Phase 4
email-based reset & impersonation remain (deferred). Admin UI: same app, gated
`/admin/*`. **To create an admin (incl. prod), see [Creating an admin](#creating-an-admin).**

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
- Admin actions (actorAdminId): **`admin.login`** (success + denied),
  **`admin.nurse.view`** (PHI access), **`admin.nurse.deactivate`** /
  **`admin.nurse.reactivate`**, **`admin.nurse.password_reset`**.

> PHI-view auditing: opening a nurse's detail (which exposes patient
> names/addresses) writes an `admin.nurse.view` event with scope only in
> metadata (`{ patientCount, activityCount }`) — never the PHI itself.

## API surface

```
POST   /api/admin/auth/login       email + password -> admin session cookie
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
GET    /api/admin/nurses           list users: signup, last login, active, counts
GET    /api/admin/nurses/:id       one nurse + full patients (PHI) + activity feed
GET    /api/admin/nurses/:id/route-runs[?before=<ISO>]  paginated run history
                                    (aggregate stats only — no PHI payloads);
                                    first page = last 7 days, then cursor pages of 30
GET    /api/admin/metrics          in-app KPIs (nurse totals, signups + 14-day
                                    trend, DAU/WAU, clients added, route runs,
                                    template coverage, onboarding risk)
POST   /api/admin/nurses/:id/deactivate      (audited)
POST   /api/admin/nurses/:id/reactivate      (audited)
POST   /api/admin/nurses/:id/reset-password  -> temp password (audited)
```

All admin routes behind `requireAdmin` (reads `routefy_admin_session` cookie,
resolves `admin_sessions` -> `admins`, rejects nurse sessions).

## Frontend

- Separate `/admin/*` route tree (`src/features/admin/`) with its own login
  screen and admin session; mounted by `App.jsx` outside the nurse shell.
- Screens: **Login**, **Users** (KPI cards + signup bar chart + users table),
  **User detail** (profile, action buttons, clients table, route-run history,
  activity feed).
- **Client table** on the detail page: search (name/address), sortable columns
  (Name/Address/Added/Status), and 20-per-page numbered pagination — all
  client-side over the loaded list (`useClientTable` + `Pagination`).
- **Route-run history**: loads the last 7 days, then a **Load more** button
  cursor-pages older runs (`NurseRouteRunsSection` + `useNurseRouteRuns`).
- **Confirm dialogs** guard deactivate / reactivate / reset-password (shared
  `ConfirmDialog`).
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
- [x] Admin frontend (same app, `/admin/*`): login screen, users table + KPIs,
      user-detail (activity feed + full patient list). `src/features/admin/`.
- [x] Frontend tests (dashboard + detail views).
- [x] Verified end-to-end against the running server (auth guard, real metrics,
      users list, detail, and the `admin.nurse.view` audit event persisting).

### Phase 3 — Admin actions ✅ (done)
- [x] Deactivate / reactivate nurse (audited) — `[id]/deactivate|reactivate`.
- [x] Reset password: temp password + `mustChangePassword`; returned once, never
      stored/logged — `[id]/reset-password`.
- [x] Enforce forced change: `mustChangePassword` surfaced in login/me/signup;
      App renders a blocking `ForcedPasswordChange` gate; self-service change
      clears the flag.
- [x] Frontend action buttons on the detail page (+ one-time temp-password panel).
- [x] Tests: each action audited; forced-change guards; whole reset→change chain
      verified end-to-end against the running server.

### Phase 4 — Later / optional
- [x] Richer analytics charts + metrics: 14-day signup bar chart, Route runs
      (7d/30d), Template coverage (global), Onboarding follow-up (never-logged-in
      / no-clients). Backend `getAdminMetrics` + `SignupTrendChart`.
- [ ] Email provider → real self-service reset links. *(deferred — needs infra)*
- [ ] Impersonation (only with a hard audit trail) if a support need appears.
      *(deferred — riskiest)*

### Post-plan enhancements (shipped) ✅
- [x] Per-nurse **route-run history** endpoint + UI (paginated; aggregate-only,
      no PHI payloads).
- [x] Client table **pagination (20/page) + search + sort**.
- [x] **Confirm dialogs** on deactivate / reactivate / reset-password.
- [x] **Repository unit tests** (chainable `getDb` stub) to keep global branch
      coverage ≥ 80%.

## Creating an admin

There is **no self-signup** — admin accounts are created out-of-band. Log in at
`/admin` with an account that exists in the target database's `admins` table.

### Local / dev — seed script

```sh
cd backend
npm run admin:create you@email.com "Your Name"      # prompts for the password (hidden)
# or non-interactive:
ADMIN_PASSWORD='…' npm run admin:create you@email.com "Your Name"
```

Reads `DATABASE_URL` from `backend/.env.local` (the dev DB). bcrypt cost 12,
10-char minimum, fails on duplicate email.

### Production — either method

**A. Seed script against prod** — override `DATABASE_URL` inline with the prod
value (from Vercel env vars; pooled URL is fine for this insert):

```sh
cd backend
DATABASE_URL='postgres://…PROD…' node scripts/create-admin.mjs you@email.com "Your Name"
```

**B. Neon SQL editor** — bcrypt via `pgcrypto` (the app's bcryptjs verifies
`$2a$` hashes; cost 12 matches the seed script):

```sql
create extension if not exists pgcrypto;
insert into admins (email, display_name, password_hash)
values (lower(trim('you@email.com')), 'Your Name',
        crypt('YOUR_STRONG_PASSWORD', gen_salt('bf', 12)));
```

Reset an existing admin's password: `update admins set password_hash =
crypt('NEW', gen_salt('bf', 12)), updated_at = now() where email = lower('…');`

> The plaintext password appears in the script/SQL and lands in shell or Neon
> query history — use a throwaway password and rotate after first login. Requires
> the `admins` table to exist in prod (migration `0020`, auto-applied on deploy).

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
