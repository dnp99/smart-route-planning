// Dev-only helper to simulate the "inactive clients" (30+ days unused) flow on a
// local DB without waiting 30 days. It backdates a few of a nurse's active
// clients so the Clients-page review banner + dashboard "Inactive clients" KPI
// light up. It mutates the DB pointed to by DATABASE_URL — point it at a local
// /dev database, NOT production.
//
// Usage (from backend/):
//   node scripts/simulate-stale-clients.mjs <login-email> [count]   # backdate `count` clients (default 3)
//   node scripts/simulate-stale-clients.mjs <login-email> reset     # undo — mark them recently used again
//
// "Stale" = active AND last_scheduled_at older than 30 days. We set
// last_scheduled_at to 45 days ago (reversible: reset nulls it back out), and
// clear the nurse's review snooze so the banner shows immediately.

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const envText = readFileSync(join(here, "..", ".env.local"), "utf8");
  const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match) {
    throw new Error("DATABASE_URL not set and not found in backend/.env.local");
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
};

const email = process.argv[2];
const arg3 = process.argv[3];
const isReset = arg3 === "reset";
const count = !isReset && arg3 ? Math.max(1, Number(arg3) || 3) : 3;

if (!email) {
  console.error(
    "Usage: node scripts/simulate-stale-clients.mjs <login-email> [count|reset]",
  );
  process.exit(1);
}

const sql = postgres(resolveDatabaseUrl(), { max: 1, prepare: false });

try {
  const [nurse] = await sql`select id, email from nurses where email = ${email} limit 1`;
  if (!nurse) {
    console.error(`No nurse found with email "${email}". Known accounts:`);
    const all = await sql`select email from nurses order by email`;
    all.forEach((row) => console.error(`  - ${row.email}`));
    process.exit(1);
  }

  if (isReset) {
    const restored = await sql`
      update patients
      set last_scheduled_at = null, updated_at = now()
      where nurse_id = ${nurse.id}
        and is_active = true
        and last_scheduled_at is not null
        and last_scheduled_at < now() - interval '30 days'
      returning id`;
    console.log(`Reset ${restored.length} client(s) back to "recently used".`);
  } else {
    const targets = await sql`
      select id, first_name, last_name from patients
      where nurse_id = ${nurse.id} and is_active = true
      order by created_at asc
      limit ${count}`;

    if (targets.length === 0) {
      console.log("No active clients found for this nurse — add a few clients first.");
    } else {
      const ids = targets.map((row) => row.id);
      await sql`
        update patients
        set last_scheduled_at = now() - interval '45 days', updated_at = now()
        where id in ${sql(ids)}`;
      await sql`update nurses set last_deactivated_clients_at = null where id = ${nurse.id}`;

      console.log(`Backdated ${targets.length} client(s) to "unused 45 days ago":`);
      targets.forEach((row) => console.log(`  - ${row.first_name} ${row.last_name}`));
      console.log("Cleared the review snooze.");
      console.log("\nReload /clients to see the review banner; /home shows the Inactive clients KPI.");
      console.log(`Undo with: node scripts/simulate-stale-clients.mjs ${email} reset`);
    }
  }
} finally {
  await sql.end();
}
