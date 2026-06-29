// Applies pending Drizzle migrations during a Vercel build, before `next build`
// runs. Wired via backend/vercel.json `buildCommand`.
//
// Runs on both production and preview deploys — preview uses its own database, so
// each preview migrates its own DB (and gets the new schema). Local builds skip
// (run `npm run db:migrate` manually when you mean to).
//
// drizzle-kit migrate is idempotent (it tracks applied migrations and skips
// them), so this is safe on every deploy. If a migration fails, the build fails
// and the broken deploy never goes live.
//
// Requires DATABASE_URL_UNPOOLED (preferred — Neon's pooler doesn't reliably
// apply DDL) or DATABASE_URL in the matching Vercel environment (production /
// preview), each pointing at that environment's own database.

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production" && env !== "preview") {
  console.log(`[migrate-on-deploy] Skipping migrations (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}

console.log(`[migrate-on-deploy] Applying database migrations (${env})…`);
execSync("drizzle-kit migrate --config=drizzle.config.ts", { stdio: "inherit" });
console.log("[migrate-on-deploy] Migrations up to date.");
