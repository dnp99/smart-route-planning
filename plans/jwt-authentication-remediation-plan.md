# JWT Authentication Remediation Plan

Date noted: 2026-03-13

## Objective

Safely remediate the current JWT-auth rollout so legacy nurse/patient data can
survive the transition from the single default-nurse model to account-based
authentication.

This plan focuses on three issues found on the current auth branch:

- the auth migration is unsafe for databases that already contain `nurses` rows
- legacy patients can become invisible if signup creates a new nurse row
- duplicate signup requests can race and surface as `500` instead of `409`

## Current State (repo evidence)

- `backend/drizzle/0001_useful_skaar.sql` adds `email`, `password_hash`,
  `is_active`, and `last_login_at`, then immediately makes `email` and
  `password_hash` non-null.
- the pre-auth schema in `backend/drizzle/0000_swift_shiver_man.sql` created
  `nurses` without auth columns, so any existing nurse row will start with
  null auth data during an upgrade.
- signup currently creates a brand-new nurse row in
  `backend/src/lib/patients/patientRepository.ts`.
- patient CRUD is now scoped by JWT nurse id in
  `backend/src/app/api/patients/route.ts` and
  `backend/src/app/api/patients/[id]/route.ts`.
- signup currently does a read-then-insert flow, which is race-prone when two
  requests use the same email concurrently.

## Target Outcome

After this remediation work:

- an existing database can upgrade without dropping or manually rewriting data
- the legacy nurse row keeps its original `id`, so existing patients remain
  visible after login
- shared environments have a deterministic bootstrap path for the first real
  authenticated nurse account
- duplicate email signup returns `409 Conflict` deterministically
- rollout and deployment docs explain the exact migration/backfill order

## Scope

### In scope

- rewrite or replace the unsafe auth migration path
- add a legacy-account bootstrap/backfill flow that upgrades an existing nurse
  row in place
- preserve nurse identity for existing patient ownership
- harden signup against unique-email races
- update tests, docs, and rollout instructions

### Out of scope

- refresh tokens or session revocation
- password reset or email verification
- multi-tenant authorization redesign beyond the current nurse model
- route-planner feature changes unrelated to auth remediation

## Recommended Remediation Model

## 1) Preserve nurse identity instead of creating replacement rows

The first authenticated account for upgraded environments should reuse the
existing legacy nurse row rather than inserting a new nurse record.

Recommended rule:

- treat the legacy nurse row as the source of truth for existing patient
  ownership
- upgrade that row with auth credentials in place
- preserve the existing `nurses.id` so `patients.nurse_id` remains valid

This keeps the current patient ownership model intact and avoids data-copy or
patient-reassignment logic.

## 2) Move to a two-stage schema rollout

Recommended migration strategy:

### Stage 1 — Transitional auth columns

- add `email`, `password_hash`, `is_active`, and `last_login_at`
- keep `email` and `password_hash` nullable during the transition
- add a unique guarantee only for populated emails
- prefer a case-insensitive uniqueness rule such as a unique index on
  `lower(email)` where `email is not null`

### Stage 2 — Finalized auth constraints

- after legacy rows are backfilled, make `email` non-null
- make `password_hash` non-null
- retain the final database-level email uniqueness guarantee

This avoids blocking upgrades while still ending with strict runtime and schema
guarantees.

## 3) Add an explicit legacy-auth bootstrap step

Do not rely on signup to “discover” or “claim” legacy data.

Recommended bootstrap behavior:

- add a one-time backend command or script that upgrades an existing nurse row
  in place
- target the row by `external_key` (defaulting to the legacy POC nurse key)
- normalize the configured email to lowercase
- hash the configured password
- set `is_active = true`
- leave `id` unchanged
- fail fast if:
  - the legacy row does not exist
  - the configured email is already used by another nurse
  - multiple candidate rows exist or the state is ambiguous

Recommended operator inputs:

- legacy nurse selector (for example `external_key`)
- bootstrap email
- bootstrap password
- optional updated display name

## 4) Make signup conflict-safe at the database boundary

Signup correctness must rely on the database uniqueness guarantee, not only on
an application-level pre-check.

Recommended behavior:

- keep the existing friendly pre-check if desired for UX
- also catch database unique-constraint violations on insert
- map duplicate email to `409 Conflict`
- keep the stored email normalized before insert

This preserves usability while preventing intermittent `500` errors under
concurrency.

## Likely File Touch Points

- `backend/drizzle/0001_useful_skaar.sql` or replacement follow-up migrations
- `backend/drizzle/meta/*`
- `backend/src/db/schema.ts`
- `backend/src/lib/patients/patientRepository.ts`
- `backend/src/app/api/auth/signup/route.ts`
- `backend/src/app/api/auth/login/route.ts`
- new legacy bootstrap script under `backend/src/db/`
- auth, repository, and patient-visibility tests
- `README.md`
- `backend/README.md`
- `DEPLOYMENT.md`
- `backend/.env.local.example`

## Backend Implementation Plan (phased)

## Phase A — Choose the migration strategy boundary

Decide which of the following is true before editing migration files:

### Branch-only / not yet deployed

- if the current auth migration has only been used in disposable local
  databases, rewrite the migration path on this branch before merge

### Already applied in shared environments

- if any shared or durable environment has already applied the current auth
  migration, do not rewrite applied history
- instead add forward-only corrective migrations and a bootstrap path

This decision must be made first because it changes how safely we can alter the
existing Drizzle migration files.

## Phase B — Introduce the transitional migration path

- create the safe transitional migration stage for auth columns
- keep legacy rows valid during the rollout by allowing null auth fields
- add case-insensitive uniqueness for populated emails
- update Drizzle metadata and schema definitions to match the transitional
  database shape

Validation for this phase:

- a database containing pre-auth nurse rows migrates successfully
- no patient rows are modified or reassigned during migration

## Phase C — Add legacy nurse bootstrap tooling

- implement a backend script/command that upgrades the legacy nurse row in place
- make the script idempotent where possible
- return clear errors for ambiguous or unsafe states
- document the exact operator command and required env vars

Validation for this phase:

- the script updates the existing nurse row rather than inserting a new one
- the nurse can log in after bootstrap
- previously created patients remain visible to that nurse

## Phase D — Harden runtime auth behavior during transition

- make runtime code tolerant of legacy rows with null auth fields until
  backfill completes
- ensure login ignores or rejects rows that are not yet bootstrapped for auth
- keep patient authorization unchanged once a valid JWT is issued
- preserve email normalization at the application boundary

Validation for this phase:

- pre-bootstrap legacy rows cannot authenticate accidentally
- bootstrapped rows can authenticate normally
- protected patient endpoints still scope by the authenticated nurse id

## Phase E — Fix signup race handling

- centralize duplicate-email handling around the database uniqueness guarantee
- translate unique-constraint insert failures to `409 Conflict`
- add regression tests for duplicate signup under repository/route failure paths

Validation for this phase:

- duplicate email returns `409`
- unknown insert errors still return the correct generic fallback behavior

## Phase F — Tighten final constraints after verified backfill

- add the final migration that makes auth fields non-null
- remove temporary nullable branches from schema/runtime once all target
  environments are backfilled
- keep the final uniqueness enforcement in place

Validation for this phase:

- no nurse row remains with null `email`
- no nurse row remains with null `password_hash`
- login and patient visibility still work on the finalized schema

## Testing Plan

## Backend automated tests

- migration-path test or documented upgrade rehearsal against a pre-auth schema
- legacy bootstrap script tests:
  - upgrades the expected nurse row
  - refuses ambiguous state
  - refuses duplicate bootstrap email
- signup tests:
  - duplicate email returns `409`
  - unique-constraint failure is mapped correctly
- auth tests:
  - bootstrapped nurse can log in
  - pre-bootstrap legacy nurse cannot log in with missing auth fields
- patient tests:
  - legacy patient records remain visible after bootstrap login

## Manual verification

- start from a database snapshot that matches the pre-auth schema
- apply the transitional migration
- run the legacy bootstrap command
- log in with the bootstrapped account
- confirm existing patients are listed without reassignment
- attempt duplicate signup and confirm `409`

## Documentation updates

- document the difference between greenfield signup and legacy upgrade bootstrap
- add explicit rollout order to deployment docs
- explain when it is safe to run the final non-null constraint migration
- note any one-time operator env vars or commands required for upgrade

## Rollout Sequence

1. Determine whether the current auth migration has been applied anywhere
   durable.
2. Choose rewrite-vs-corrective migration strategy based on that answer.
3. Ship the transitional migration path.
4. Run the legacy bootstrap command for the existing nurse account.
5. Verify login and patient visibility using the preserved nurse id.
6. Ship signup conflict handling.
7. After all environments are backfilled, ship the final non-null constraint
   migration.

## Risks and Mitigations

- migration-history drift in local environments
  - mitigate with explicit branch-local reset guidance for disposable dev DBs
- bootstrap email collision
  - mitigate by checking for existing email ownership before update
- accidental creation of a second nurse row during upgrade
  - mitigate by forbidding bootstrap logic from inserting replacement records
- case-variant duplicate emails
  - mitigate with lowercased normalization plus case-insensitive DB uniqueness
- premature final constraint migration
  - mitigate with a preflight query/runbook step that proves no null auth data
    remains

## Done Criteria

- upgraded environments no longer fail on legacy nurse rows during auth rollout
- the first authenticated legacy nurse account reuses the original nurse id
- existing patients remain visible after login without reassignment
- duplicate signup returns `409 Conflict` reliably
- docs describe the exact migration/bootstrap/finalization order
- backend and frontend regression suites pass after the remediation is
  implemented
