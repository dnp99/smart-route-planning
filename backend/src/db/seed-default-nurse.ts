import { getDb, closeDb } from "./index";
import { nurses } from "./schema";
import { hashPassword } from "../lib/auth/password";

export const seedDefaultNurse = async () => {
  const defaultNurseExternalKey = process.env.DEFAULT_NURSE_ID?.trim() || "default-nurse";
  const defaultNurseEmail =
    process.env.DEFAULT_NURSE_EMAIL?.trim().toLowerCase() || "nicole@careflow.local";
  const defaultNursePassword = process.env.DEFAULT_NURSE_PASSWORD?.trim() || "careflow-dev-password";
  const passwordHash = await hashPassword(defaultNursePassword);

  await getDb()
    .insert(nurses)
    .values({
      externalKey: defaultNurseExternalKey,
      displayName: "Nicole Su",
      email: defaultNurseEmail,
      passwordHash,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: nurses.externalKey,
      set: {
        displayName: "Nicole Su",
        email: defaultNurseEmail,
        passwordHash,
        isActive: true,
      },
    });
};

const run = async () => {
  try {
    await seedDefaultNurse();
  } finally {
    await closeDb();
  }
};

void run();
