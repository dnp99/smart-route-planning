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

// Drizzle Kit does not auto-load .env.local, so load env files explicitly.
loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
