import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { auditEvents, nurses, patients } from "../../db/schema";

export type AdminNurseSummary = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  activePatientCount: number;
  lastActivityAt: Date | null;
};

// One row per nurse with the at-a-glance counts the admin users table needs.
// The two aggregates (active-client count, last-activity time) are fetched as
// grouped queries and merged in memory rather than as correlated subqueries —
// simpler to read and index-friendly on the existing patient/audit indexes.
export const listNursesWithSummary = async (): Promise<AdminNurseSummary[]> => {
  const db = getDb();

  const nurseRows = await db
    .select({
      id: nurses.id,
      email: nurses.email,
      displayName: nurses.displayName,
      isActive: nurses.isActive,
      mustChangePassword: nurses.mustChangePassword,
      createdAt: nurses.createdAt,
      lastLoginAt: nurses.lastLoginAt,
    })
    .from(nurses)
    .orderBy(desc(nurses.createdAt));

  const activeCounts = await db
    .select({
      nurseId: patients.nurseId,
      count: sql<number>`count(*)::int`,
    })
    .from(patients)
    .where(eq(patients.isActive, true))
    .groupBy(patients.nurseId);

  const lastActivity = await db
    .select({
      nurseId: auditEvents.actorNurseId,
      lastAt: sql<Date>`max(${auditEvents.createdAt})`,
    })
    .from(auditEvents)
    .where(isNotNull(auditEvents.actorNurseId))
    .groupBy(auditEvents.actorNurseId);

  const countByNurse = new Map(activeCounts.map((row) => [row.nurseId, row.count]));
  const activityByNurse = new Map(lastActivity.map((row) => [row.nurseId, row.lastAt]));

  return nurseRows.map((nurse) => ({
    ...nurse,
    activePatientCount: countByNurse.get(nurse.id) ?? 0,
    lastActivityAt: activityByNurse.get(nurse.id) ?? null,
  }));
};
