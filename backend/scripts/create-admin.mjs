// One-off helper to create an admin account (there is no admin self-signup).
// Use it to bootstrap the first admin, or to add more later. It mutates the DB
// pointed to by DATABASE_URL — point it at the environment you mean to.
//
// Usage (from backend/):
//   node scripts/create-admin.mjs <email> "<Display Name>"
//     → prompts for the password (hidden), confirms, then inserts.
//
//   ADMIN_PASSWORD='...' node scripts/create-admin.mjs <email> "<Display Name>"
//     → non-interactive (CI/seed). Avoid putting the password on the argv so it
//       doesn't land in shell history.
//
// Password is hashed with bcrypt (12 rounds) to match the app's auth. Fails if
// an admin with that email already exists.

import postgres from "postgres";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;
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

// Prompt without echoing the typed characters to the terminal.
const promptHidden = (question) =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    // Print the question, then suppress echo of the typed answer.
    rl._writeToOutput = (str) => {
      if (muted && !str.includes(question)) {
        return;
      }
      rl.output.write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });

const email = (process.argv[2] ?? "").trim().toLowerCase();
const displayName = (process.argv[3] ?? "").trim();

if (!email || !displayName) {
  console.error('Usage: node scripts/create-admin.mjs <email> "<Display Name>"');
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" does not look like a valid email address.`);
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  password = await promptHidden("New admin password: ");
  const confirm = await promptHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords did not match.");
    process.exit(1);
  }
}

if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const sql = postgres(resolveDatabaseUrl(), { max: 1, prepare: false });

try {
  const [existing] = await sql`select id from admins where email = ${email} limit 1`;
  if (existing) {
    console.error(`An admin with email "${email}" already exists (id ${existing.id}).`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [created] = await sql`
    insert into admins (email, display_name, password_hash)
    values (${email}, ${displayName}, ${passwordHash})
    returning id, email, display_name
  `;

  console.log(`Created admin "${created.display_name}" <${created.email}> (id ${created.id}).`);
} finally {
  await sql.end();
}
