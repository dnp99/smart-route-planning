import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { nurses } from "../../db/schema";

// Admin-initiated nurse mutations. Each returns the touched row (or null when no
// nurse matched, so the caller can 404). Password resets are covered by
// resetNursePassword; ordinary self-service changes go through the auth flow.

export const setNurseActive = async (nurseId: string, isActive: boolean) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(nurses.id, nurseId))
    .returning({ id: nurses.id, isActive: nurses.isActive });
  return nurse ?? null;
};

export const resetNursePassword = async (nurseId: string, passwordHash: string) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(nurses.id, nurseId))
    .returning({ id: nurses.id });
  return nurse ?? null;
};
