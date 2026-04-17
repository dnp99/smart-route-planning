import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { authSessions } from "../../db/schema";
import { getSessionMaxAgeSeconds } from "./sessionCookie";

const toExpiryDate = (now = new Date()) =>
  new Date(now.getTime() + getSessionMaxAgeSeconds() * 1000);

export const createAuthSession = async ({
  nurseId,
  ipAddress,
  userAgent,
}: {
  nurseId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const now = new Date();
  const sessionId = crypto.randomUUID();

  const [session] = await getDb()
    .insert(authSessions)
    .values({
      id: sessionId,
      nurseId,
      expiresAt: toExpiryDate(now),
      lastSeenAt: now,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })
    .returning();

  return session ?? null;
};

export const findValidAuthSessionById = async (sessionId: string) => {
  const [session] = await getDb()
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return session ?? null;
};

export const touchAuthSession = async (sessionId: string) => {
  await getDb()
    .update(authSessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(authSessions.id, sessionId));
};

export const revokeAuthSession = async (sessionId: string) => {
  const now = new Date();
  await getDb()
    .update(authSessions)
    .set({
      revokedAt: now,
      lastSeenAt: now,
    })
    .where(eq(authSessions.id, sessionId));
};
