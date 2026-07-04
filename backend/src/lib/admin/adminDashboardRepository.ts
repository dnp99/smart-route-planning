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

export type AdminNurseProfile = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  homeAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export const getNurseProfile = async (nurseId: string): Promise<AdminNurseProfile | null> => {
  const [row] = await getDb()
    .select({
      id: nurses.id,
      email: nurses.email,
      displayName: nurses.displayName,
      isActive: nurses.isActive,
      mustChangePassword: nurses.mustChangePassword,
      homeAddress: nurses.homeAddress,
      createdAt: nurses.createdAt,
      updatedAt: nurses.updatedAt,
      lastLoginAt: nurses.lastLoginAt,
    })
    .from(nurses)
    .where(eq(nurses.id, nurseId))
    .limit(1);
  return row ?? null;
};

export type AdminNursePatient = {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
};

// Full patient detail (PHI) for one nurse — names and addresses included. Reads
// through here are audited by the caller as an admin.nurse.view.
export const listNursePatients = async (nurseId: string): Promise<AdminNursePatient[]> =>
  getDb()
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      address: patients.address,
      isActive: patients.isActive,
      archivedAt: patients.archivedAt,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(eq(patients.nurseId, nurseId))
    .orderBy(desc(patients.createdAt));

export type AdminActivityEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export const listNurseActivity = async (
  nurseId: string,
  limit = 100,
): Promise<AdminActivityEvent[]> =>
  getDb()
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      resourceType: auditEvents.resourceType,
      resourceId: auditEvents.resourceId,
      outcome: auditEvents.outcome,
      metadata: auditEvents.metadata,
      ipAddress: auditEvents.ipAddress,
      userAgent: auditEvents.userAgent,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(eq(auditEvents.actorNurseId, nurseId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(Math.max(1, Math.min(500, limit)));
