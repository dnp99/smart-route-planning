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

// Fail the build loudly rather than silently skipping migrations when the env is
// misconfigured.
if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.error(
    `[migrate-on-deploy] No database URL for VERCEL_ENV=${env}. Set DATABASE_URL_UNPOOLED ` +
      "(preferred) or DATABASE_URL for this Vercel environment, then redeploy. Aborting build.",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.warn(
    "[migrate-on-deploy] DATABASE_URL_UNPOOLED is not set — using the pooled DATABASE_URL. " +
      "Neon's pooler can silently fail to apply DDL; set the direct (unpooled) URL for reliable migrations.",
  );
}

console.log(`[migrate-on-deploy] Applying database migrations (${env})…`);
execSync("drizzle-kit migrate --config=drizzle.config.ts", { stdio: "inherit" });
console.log("[migrate-on-deploy] Migrations up to date.");
