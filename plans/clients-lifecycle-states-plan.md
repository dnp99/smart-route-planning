# Clients lifecycle states (Active / Idle / Archived) + 7-day archived visibility

## Status
IMPLEMENTED — backend (`96a0a45`), frontend (`9a67862`), docs/policy (this commit).
Superseded the stale-review **banner** (`e463ee8`, `da7b237`, `596c321`, `d6b380e`).
**Action still required:** run `cd backend && npm run db:migrate` against the target DB to
apply migration `0019_ambitious_johnny_storm.sql` (adds `patients.archived_at`). Optional
backfill for pre-existing archived rows:
`UPDATE patients SET archived_at = updated_at WHERE is_active = false AND archived_at IS NULL;`
Right-to-erasure / hard delete remains deferred (see decision 4).

## Goal
Replace the dismissible "idle clients" banner with a **state-tabbed Clients page**
(Active / Idle / Archived), URL-driven (`/clients?state=…`). Archive-only (no hard
delete). Add **Restore**. Archived clients are **user-visible for 7 days only**, then
hidden from every user surface but **retained in the DB** for traceability.

## State model
| Tab | URL `?state=` | Set |
|---|---|---|
| **Active** | `active` (default) | `is_active = true` AND **not** idle 30+ days |
| **Idle** | `idle` | `is_active = true` AND idle 30+ days |
| **Archived** | `archived` | `is_active = false` AND archived within the last **7 days** |

- Mutually exclusive (Active excludes Idle).
- "idle 30+ days" = `last_scheduled_at < now()-30d` OR (`last_scheduled_at` null AND `created_at < now()-30d`).
- Archived rows older than 7 days exist in the DB but appear in **no** user surface
  (not the Archived tab, search, or any count).

## Per-tab actions
| Tab | Row | Bulk |
|---|---|---|
| Active | Edit, **Archive** | — (later) |
| Idle | Edit, **Archive** | select → Archive selected |
| Archived | **Restore**, View (read-only) | — |

- "Archive" replaces today's "Delete" (it was always a soft-delete). Confirm copy →
  "You can restore it from the Archived tab for 7 days."
- Restore is only possible while the row is visible (within 7 days). After 7 days the
  client is no longer user-recoverable (gone from their view; retained server-side).

## Schema change (needs a migration)
Add to `patients` (`backend/src/db/schema.ts`):
- `archivedAt: timestamp("archived_at", { withTimezone: true })` — nullable.

Why a dedicated column (not reuse `updated_at`): the 7-day window is a
compliance-facing boundary; it must be explicit and not perturbed by unrelated row
updates. Set on archive, cleared (null) on restore.

Migration workflow (per CLAUDE.md — never hand-write):
1. Edit `schema.ts`.
2. `cd backend && npm run db:generate` (needs live `DATABASE_URL`; you run it).
3. `npm run db:migrate`.
4. **Backfill** existing archived rows so they don't all vanish/appear wrongly:
   `UPDATE patients SET archived_at = updated_at WHERE is_active = false AND archived_at IS NULL;`
   (separate one-off — drizzle generate emits DDL only, not data.)

## Backend
- **`patientRepository.ts`**
  - Extract `staleCondition(now)` (shared by list + count).
  - `listPatientsByNurse(nurseId, { query, state })`:
    - `active`: `is_active=true` AND NOT stale
    - `idle`: `is_active=true` AND stale
    - `archived`: `is_active=false` AND `archived_at >= now()-7d`, order by `archived_at desc`
  - `archivePatientsForNurse` + single archive (`deletePatientForNurse`): also set `archived_at = now()`.
  - **Add** `restorePatientForNurse(nurseId, id)` → `is_active=true, archived_at=null`.
  - **Simplify** `countStaleClientsForNurse` → drop the snooze (no banner); just count active+idle.
  - **Remove** `getStaleClientReviewForNurse`, `dismissStaleClientReviewForNurse`.
    `nurses.last_deactivated_clients_at` becomes unused (leave column; later cleanup).
- **Routes**
  - `GET /api/patients?state=…&query=…` (extend existing; default `active`).
  - **Add** `POST /api/patients/[id]/restore`.
  - **Remove** `app/api/patients/stale/`. Keep `app/api/patients/archive/`.
- **`dashboardRepository.ts`** — `staleClientsCount` is now snooze-free (single query;
  revert the earlier 2-query test mocks).

## Frontend
- **`PatientsPage.tsx`** — read `state` from URL (default `active`); render Active / Idle /
  Archived tabs that drive the URL; fetch per state. Window-type filter (All/Fixed/Flexible)
  stays on Active+Idle, hidden on Archived. **Remove** `StaleClientReviewBanner` +
  `useStaleClientReview`. Archived empty state explains the 7-day window.
- **`PatientsTable.tsx`** — state-aware row actions (desktop + mobile cards): Edit/Archive
  (Active+Idle), Restore/View (Archived); multi-select archive on Idle.
- **`patientService.ts`** — `listPatients(query, state)`, `restoreClient(id)`; keep
  `archiveClients`; remove `fetchStaleClients`/`dismissStaleReview`.
- **`HomePage.tsx`** — KPI **"Inactive clients" → "Idle clients"**, link `/clients?state=idle`,
  non-clickable at 0 (as today).

## Retention & compliance  ⚠️ needs your sign-off / legal review
The "retained in DB but hidden from the user after 7 days" model has privacy weight
(PHI; right-to-erasure under PIPEDA/GDPR/HIPAA-style regimes). Decisions to make:
1. **Retention period for hidden rows** — indefinite, or purged after a defined window?
   "Hidden forever" usually still needs a bounded retention + eventual purge. Ties into
   the already-deferred PHI column cleanup.
2. **Right-to-erasure path** — an out-of-band (non-user) way to truly delete a client's
   data on a verified request, since the user UI can no longer reach it after 7 days.
3. **Legal copy is drafted, not authoritative** — the Terms/Privacy wording below must be
   reviewed/approved by whoever owns compliance before shipping. I'll draft; I won't
   present it as final legal text.

## Docs / policy updates
- **`frontend/src/components/legal/TermsPage.tsx`** — expand the deletion clause: archived
  clients are restorable for 7 days, then removed from the interface but retained
  internally for traceability for [RETENTION PERIOD — TBD].
- **Privacy Policy page** (locate; add a data-retention clause matching the above).
- **`docs/`** — a short data-lifecycle/retention note (Active→Idle→Archived→hidden-retained),
  plus update any client-deletion references.
- Cross-check the in-app privacy reminder copy on the Clients page.

## Tests
- `patientRepository.test.ts`: state-filtered list (incl. 7-day archived window), restore,
  archived_at set/cleared, snooze-free count; drop stale/dismiss tests.
- `dashboardRepository.test.ts`: single-query count (revert 2-query mocks).
- New `restore` route test; drop banner tests; update frontend mocks (remove
  `fetchStaleClients` etc.).

## Decisions (locked)
1. **Slugs:** `active` / `idle` / `archived`.
2. **Dashboard KPI:** rename "Inactive clients" → **"Idle clients"** → `/clients?state=idle`.
3. **Retention of hidden archived rows:** **indefinite for now** (data-warehouse migration later).
   No purge job in this work.
4. **Right-to-erasure / hard delete:** **NOT in this work — deferred to later.** No hard-delete
   API or script will be built now. Captured for when it's picked up:
   - Must be **operator/admin only** (never the nurse API; the nurse model stays archive-only).
     Prefer a guarded `--dry-run` CLI script over a network endpoint.
   - Two scopes: per-client (true erasure) and per-nurse-email (account-data purge — a different
     use case).
   - **Cascade gotcha:** deleting a `patients` row auto-cascades to `patient_visit_windows`,
     `recurring_visit_templates`, `visit_instances`. It does **NOT** reach
     `route_optimization_tasks`, which stores denormalized `patient_name` + `address` under a
     plain **text `patient_id` (no FK)** — a purge must explicitly delete/redact those rows or
     the "erased" PHI survives. (Ties into the deferred PHI-column cleanup.)
   - Until then, erasure requests are handled ad hoc by the operator.
5. **Legal copy:** ship the *drafted* Terms/Privacy retention language for now (only 1 test user
   in prod); have it properly reviewed before broader rollout.
6. **Migrations:** user runs `db:generate` + `db:migrate` locally (live DATABASE_URL).
