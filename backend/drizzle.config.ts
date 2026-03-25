import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const loadEnvFile = (relativePath: string) => {
  const fullPath = resolve(process.cwd(), relativePath);
  if (!existsSync(fullPath)) {
    return;
  }

  const fileContent = readFileSync(fullPath, "utf8");
  const lines = fileContent.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquotedValue =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = unquotedValue;
  });
};

// Capture explicitly-passed env vars before loading files so file-loaded values
// don't silently override a DATABASE_URL passed on the command line.
const explicitDatabaseUrl = process.env.DATABASE_URL;
const explicitDatabaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED;

// Drizzle Kit does not auto-load .env.local, so load env files explicitly.
loadEnvFile(".env.local");
loadEnvFile(".env");

// Prefer the unpooled (direct) connection for migrations — Neon's pooler runs
// PgBouncer in transaction mode and does not reliably apply DDL.
// Only use DATABASE_URL_UNPOOLED from env files when DATABASE_URL was not
// explicitly overridden on the command line (otherwise it routes to the wrong
// Neon branch).
const migrationUrl = explicitDatabaseUrlUnpooled
  ?? (explicitDatabaseUrl ? explicitDatabaseUrl : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ""));

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl,
  },
  strict: true,
  verbose: true,
});
