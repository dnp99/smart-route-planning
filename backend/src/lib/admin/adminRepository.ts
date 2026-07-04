import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { admins, type NewAdmin } from "../../db/schema";

export const findAdminByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const [admin] = await getDb()
    .select()
    .from(admins)
    .where(eq(admins.email, normalizedEmail))
    .limit(1);
  return admin ?? null;
};

export const findAdminById = async (adminId: string) => {
  const [admin] = await getDb().select().from(admins).where(eq(admins.id, adminId)).limit(1);
  return admin ?? null;
};

export const updateAdminLastLoginAt = async (adminId: string) => {
  await getDb()
    .update(admins)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(admins.id, adminId));
};

export const insertAdmin = async (
  admin: Pick<NewAdmin, "email" | "displayName" | "passwordHash">,
) => {
  const [created] = await getDb()
    .insert(admins)
    .values({
      email: admin.email.trim().toLowerCase(),
      displayName: admin.displayName,
      passwordHash: admin.passwordHash,
    })
    .returning();
  return created ?? null;
};
