# Database migrations

Drizzle ORM + `drizzle-kit`, Postgres (Neon). Migration files live in `backend/drizzle/`,
tracked in `backend/drizzle/meta/_journal.json`.

## Authoring a schema change

1. Edit `backend/src/db/schema.ts`.
2. `cd backend && npm run db:generate` — diffs the schema and writes the `NNNN_*.sql` file
   + a properly-chained snapshot. **Never hand-write migration files** (hashes/snapshots
   won't chain and `drizzle-kit migrate` silently skips them).
3. `npm run db:migrate` to apply locally (or just let auto-migration do it — below).

## Auto-migration (no manual `db:migrate` in normal flow)

- **Local dev:** a `predev` script runs `db:migrate` before `npm run dev` (local connects to
  the preview DB). Use `npm run dev:nomigrate` to skip.
- **Vercel deploys:** `backend/vercel.json` sets `buildCommand` to
  `node scripts/migrate-on-deploy.mjs && next build`. The script runs `drizzle-kit migrate`
  on **production and preview** builds (each env migrates its own DB), skips local builds, and
  **fails the build** if no `DATABASE_URL`/`DATABASE_URL_UNPOOLED` is set. `migrate` is
  idempotent, so it's safe on every deploy.
- Each Vercel environment must have its own `DATABASE_URL_UNPOOLED` (preferred — Neon's pooler
  doesn't reliably apply DDL) pointing at that environment's database.

## NEVER use `drizzle-kit push` on prod/preview

`push` syncs the schema directly **without** recording anything in `drizzle.__drizzle_migrations`.
The journal then lags the real schema, and the next `migrate` tries to re-apply changes that
already exist → `column … already exists` and a failed deploy. Only ever use generate + migrate.

## How `migrate` decides what to apply

`drizzle.__drizzle_migrations` stores one row per applied migration: `(id, hash, created_at)`,
where `created_at` is the migration's `when` timestamp from `_journal.json`. `migrate` finds the
**max `created_at`** in that table and applies every migration whose `when` is greater. So a
migration is "already applied" purely by having a recorded `created_at >=` its `when` — the
`hash` is stored for reference, not used for the skip decision.

## Runbook: reconciling journal drift (`column … already exists`)

Symptom: a deploy/migrate fails like
`DrizzleQueryError: … ADD COLUMN "x" … column "x" … already exists`.
Cause: that migration's schema is physically present (usually from a past `push`) but isn't
recorded in `__drizzle_migrations`, so `migrate` re-runs it.

Fix (run **once** against the affected DB — Neon SQL editor on that branch, or `psql` with its
connection string):

1. **Identify** the failing migration `NNNN_*.sql` (named in the error) and its `when` from
   `backend/drizzle/meta/_journal.json`. Read the `.sql` so you know **every** statement in it.
2. **Make the DB match that migration** idempotently — for each statement, apply the
   `IF NOT EXISTS` form so anything the original `push` missed gets added and the rest is a no-op,
   e.g. `ALTER TABLE t ADD COLUMN IF NOT EXISTS c <type>;`.
3. **Record it as applied** so `migrate` skips it:
   ```sql
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
   VALUES ('<hash of that migration>', <its when timestamp>);
   ```
   Get the correct `hash` + `created_at` from a healthy DB that already has it recorded:
   `SELECT hash, created_at FROM drizzle.__drizzle_migrations WHERE created_at = <when>;`
4. **Redeploy** (or `npm run db:migrate`). `migrate` now skips up to that migration and applies
   only the genuinely-new ones.

### Worked example — the 2026-06 prod drift at `0018`

Prod had `0018_regular_jetstream` (`request_payload` + `result_payload` on
`route_optimization_runs`) pushed in but unrecorded; journal stopped at `0017`. Preview was clean.

```sql
-- against PRODUCTION only
ALTER TABLE route_optimization_runs ADD COLUMN IF NOT EXISTS request_payload jsonb;
ALTER TABLE route_optimization_runs ADD COLUMN IF NOT EXISTS result_payload  jsonb;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('6535dce9aef81a9d2cb0fa98dd9d1868f1e1a6bed078d1d4f1f0c07eb1a3546e', 1777570070169);
```

Then redeploy → `migrate` applies only `0019` (`patients.archived_at`).
