import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
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
      // A raw aggregate — postgres-js/Drizzle returns this as a string (only
      // declared columns are mapped to Date), so coerce below.
      lastAt: sql<string | Date>`max(${auditEvents.createdAt})`,
    })
    .from(auditEvents)
    .where(isNotNull(auditEvents.actorNurseId))
    .groupBy(auditEvents.actorNurseId);

  const countByNurse = new Map(activeCounts.map((row) => [row.nurseId, row.count]));
  const activityByNurse = new Map(
    lastActivity.map((row) => [row.nurseId, row.lastAt ? new Date(row.lastAt) : null]),
  );

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

export type AdminMetrics = {
  nurses: { total: number; active: number };
  signups: { total: number; last7Days: number; last30Days: number };
  activeNurses: { dau: number; wau: number };
  clientsAdded: { last7Days: number; last30Days: number };
  signupTrend: { date: string; count: number }[];
};

const countInt = sql<number>`count(*)::int`;

// In-app KPIs for the admin dashboard. Signup counts/trend come from
// nurses.createdAt (accurate for accounts that predate the signup audit event);
// DAU/WAU come from login audit events (forward-looking — only logins recorded
// after that feature shipped count). No PHI is read here.
export const getAdminMetrics = async (now = new Date()): Promise<AdminMetrics> => {
  const db = getDb();
  const dayMs = 24 * 60 * 60 * 1000;
  const since = (days: number) => new Date(now.getTime() - days * dayMs);

  const [nurseTotals] = await db
    .select({
      total: countInt,
      active: sql<number>`count(*) filter (where ${nurses.isActive})::int`,
    })
    .from(nurses);

  const [signupTotal] = await db.select({ total: countInt }).from(nurses);
  const [signups7] = await db
    .select({ total: countInt })
    .from(nurses)
    .where(gte(nurses.createdAt, since(7)));
  const [signups30] = await db
    .select({ total: countInt })
    .from(nurses)
    .where(gte(nurses.createdAt, since(30)));

  const distinctLoginActors = (days: number) =>
    db
      .select({ n: sql<number>`count(distinct ${auditEvents.actorNurseId})::int` })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "login"),
          isNotNull(auditEvents.actorNurseId),
          gte(auditEvents.createdAt, since(days)),
        ),
      );

  const [dau] = await distinctLoginActors(1);
  const [wau] = await distinctLoginActors(7);

  const clientsAddedSince = (days: number) =>
    db
      .select({ n: countInt })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "patients.create"),
          eq(auditEvents.outcome, "success"),
          gte(auditEvents.createdAt, since(days)),
        ),
      );

  const [clients7] = await clientsAddedSince(7);
  const [clients30] = await clientsAddedSince(30);

  const trendRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${nurses.createdAt}), 'YYYY-MM-DD')`,
      count: countInt,
    })
    .from(nurses)
    .where(gte(nurses.createdAt, since(14)))
    .groupBy(sql`date_trunc('day', ${nurses.createdAt})`)
    .orderBy(sql`date_trunc('day', ${nurses.createdAt})`);

  return {
    nurses: { total: nurseTotals?.total ?? 0, active: nurseTotals?.active ?? 0 },
    signups: {
      total: signupTotal?.total ?? 0,
      last7Days: signups7?.total ?? 0,
      last30Days: signups30?.total ?? 0,
    },
    activeNurses: { dau: dau?.n ?? 0, wau: wau?.n ?? 0 },
    clientsAdded: { last7Days: clients7?.n ?? 0, last30Days: clients30?.n ?? 0 },
    signupTrend: trendRows.map((row) => ({ date: row.day, count: row.count })),
  };
};
