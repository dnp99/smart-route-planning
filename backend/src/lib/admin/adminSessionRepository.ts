import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { adminSessions, admins } from "../../db/schema";
import { resolveDeviceTypeFromUserAgent } from "../auth/deviceType";
import { getAdminSessionMaxAgeSeconds } from "./adminSessionCookie";

const toExpiryDate = (now = new Date()) =>
  new Date(now.getTime() + getAdminSessionMaxAgeSeconds() * 1000);

export const createAdminSession = async ({
  adminId,
  ipAddress,
  userAgent,
}: {
  adminId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const now = new Date();
  const sessionId = crypto.randomUUID();

  const [session] = await getDb()
    .insert(adminSessions)
    .values({
      id: sessionId,
      adminId,
      expiresAt: toExpiryDate(now),
      lastSeenAt: now,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      deviceType: resolveDeviceTypeFromUserAgent(userAgent),
    })
    .returning();

  return session ?? null;
};

export const findValidAdminSessionWithAdmin = async (sessionId: string) => {
  const [row] = await getDb()
    .select({
      sessionId: adminSessions.id,
      adminId: admins.id,
      email: admins.email,
      displayName: admins.displayName,
      isActive: admins.isActive,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(
      and(
        eq(adminSessions.id, sessionId),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
};

export const touchAdminSession = async (sessionId: string) => {
  await getDb()
    .update(adminSessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(adminSessions.id, sessionId));
};

export const revokeAdminSession = async (sessionId: string) => {
  const now = new Date();
  await getDb()
    .update(adminSessions)
    .set({
      revokedAt: now,
      lastSeenAt: now,
    })
    .where(eq(adminSessions.id, sessionId));
};
