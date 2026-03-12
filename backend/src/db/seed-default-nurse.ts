import { getDb, closeDb } from "./index";
import { nurses } from "./schema";

export const seedDefaultNurse = async () => {
  const defaultNurseExternalKey = process.env.DEFAULT_NURSE_ID?.trim() || "default-nurse";

  await getDb()
    .insert(nurses)
    .values({
      externalKey: defaultNurseExternalKey,
      displayName: "Default Nurse",
    })
    .onConflictDoNothing({
      target: nurses.externalKey,
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
