// Applies pending Drizzle migrations during a Vercel PRODUCTION build, before
// `next build` runs. Wired via backend/vercel.json `buildCommand`.
//
// Only runs when VERCEL_ENV === "production", so:
//   - Preview deploys (PRs / non-main branches) build but never touch the prod DB.
//   - Local builds skip too (run `npm run db:migrate` manually when you mean to).
//
// drizzle-kit migrate is idempotent (it tracks applied migrations and skips
// them), so this is safe to run on every production deploy. If a migration
// fails, the build fails and the broken deploy never goes live.
//
// Requires DATABASE_URL_UNPOOLED (preferred — Neon's pooler doesn't reliably
// apply DDL) or DATABASE_URL in the Vercel production environment.

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`[migrate-on-deploy] Skipping migrations (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}

console.log("[migrate-on-deploy] Applying database migrations (production)…");
execSync("drizzle-kit migrate --config=drizzle.config.ts", { stdio: "inherit" });
console.log("[migrate-on-deploy] Migrations up to date.");
