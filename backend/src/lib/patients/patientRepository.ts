import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { nurses, patientVisitWindows, patients } from "../../db/schema";
import type {
  CreatePatientRequest,
  UpdatePatientRequest,
  WeeklyWorkingHours,
} from "../../../../shared/contracts";

export class NurseEmailConflictError extends Error {
  constructor(message = "An account with this email already exists.") {
    super(message);
    this.name = "NurseEmailConflictError";
  }
}

const FALLBACK_FLEXIBLE_START_TIME = "00:00";
const FALLBACK_FLEXIBLE_END_TIME = "23:59";
const FALLBACK_FLEXIBLE_VISIT_TYPE = "flexible";
const DAY_MS = 24 * 60 * 60 * 1000;
// A client is "idle" once it hasn't been scheduled (or, if never scheduled, created)
// within this window.
const SCHEDULING_INACTIVITY_WINDOW_DAYS = 30;
// Archived clients stay user-visible for this long, then drop out of every UI
// surface (still retained in the DB — see plans/clients-lifecycle-states-plan.md).
const ARCHIVED_VISIBILITY_DAYS = 7;

// "active" / "idle" / "archived" back the Clients-page tabs. "schedulable" is a
// query-only union (active + idle, i.e. everything except archived) used by the
// Route Planner so a client that has merely gone idle can still be scheduled.
export type PatientLifecycleState = "active" | "idle" | "archived" | "schedulable";

// "active" (not idle): scheduled within the window, or never scheduled but created
// within it. Written as the explicit complement of idleCondition so a NULL
// last_scheduled_at doesn't drop recent clients out of both buckets.
const activeCondition = (cutoff: Date) =>
  or(
    gte(patients.lastScheduledAt, cutoff),
    and(isNull(patients.lastScheduledAt), gte(patients.createdAt, cutoff)),
  );
const idleCondition = (cutoff: Date) =>
  or(
    lt(patients.lastScheduledAt, cutoff),
    and(isNull(patients.lastScheduledAt), lt(patients.createdAt, cutoff)),
  );

const runInTransaction = async <T>(operation: (db: ReturnType<typeof getDb>) => Promise<T>) => {
  const db = getDb();
  const transactionalDb = db as unknown as {
    transaction?: (fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  if (typeof transactionalDb.transaction === "function") {
    return transactionalDb.transaction((transaction) =>
      operation(transaction as ReturnType<typeof getDb>),
    );
  }

  return operation(db);
};

const isUniqueViolationError = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === "23505";
};

export const findNurseById = async (nurseId: string) => {
  const [nurse] = await getDb().select().from(nurses).where(eq(nurses.id, nurseId)).limit(1);
  return nurse ?? null;
};

export const findNurseByEmail = async (email: string) => {
  const [nurse] = await getDb().select().from(nurses).where(eq(nurses.email, email)).limit(1);
  return nurse ?? null;
};

export const createNurseAccount = async (payload: {
  displayName: string;
  email: string;
  passwordHash: string;
}) => {
  try {
    const [nurse] = await getDb()
      .insert(nurses)
      .values({
        externalKey: crypto.randomUUID(),
        displayName: payload.displayName,
        email: payload.email,
        passwordHash: payload.passwordHash,
        isActive: true,
      })
      .returning();

    return nurse;
  } catch (error) {
    if (isUniqueViolationError(error)) {
      throw new NurseEmailConflictError();
    }

    throw error;
  }
};

export const updateNurseLastLoginAt = async (nurseId: string) => {
  await getDb()
    .update(nurses)
    .set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId));
};

export const updateNurseHomeAddress = async (nurseId: string, homeAddress: string) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({
      homeAddress,
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export const updateNurseDisplayName = async (nurseId: string, displayName: string) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({
      displayName,
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export const updateNurseWorkingHours = async (
  nurseId: string,
  workingHours: WeeklyWorkingHours | null | undefined,
  breakGapThresholdMinutes: number | null | undefined,
) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({
      ...(workingHours !== undefined ? { workingHours } : {}),
      ...(breakGapThresholdMinutes !== undefined ? { breakGapThresholdMinutes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export const updateNurseOptimizationObjective = async (
  nurseId: string,
  optimizationObjective: "time" | "distance" | null,
) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({ optimizationObjective, updatedAt: new Date() })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export const updateNursePasswordHash = async (nurseId: string, passwordHash: string) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export const acknowledgeNurseLegalNotice = async (nurseId: string, version: string) => {
  const [nurse] = await getDb()
    .update(nurses)
    .set({
      legalNoticeAcceptedAt: new Date(),
      legalNoticeAcceptedVersion: version,
      updatedAt: new Date(),
    })
    .where(eq(nurses.id, nurseId))
    .returning();

  return nurse ?? null;
};

export type PatientWithVisitWindows = typeof patients.$inferSelect & {
  visitWindows: (typeof patientVisitWindows.$inferSelect)[];
};

const attachVisitWindows = async (
  patientRows: (typeof patients.$inferSelect)[],
): Promise<PatientWithVisitWindows[]> => {
  if (patientRows.length === 0) {
    return [];
  }

  const patientIds = patientRows.map((patient) => patient.id);
  const windowsResult = await getDb()
    .select()
    .from(patientVisitWindows)
    .where(inArray(patientVisitWindows.patientId, patientIds));

  const windows = Array.isArray(windowsResult) ? windowsResult : [];
  windows.sort((left, right) => {
    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    if (left.endTime !== right.endTime) {
      return left.endTime.localeCompare(right.endTime);
    }

    const leftCreatedAt = left.createdAt instanceof Date ? left.createdAt.getTime() : 0;
    const rightCreatedAt = right.createdAt instanceof Date ? right.createdAt.getTime() : 0;
    return leftCreatedAt - rightCreatedAt;
  });

  const windowsByPatientId = new Map<string, (typeof patientVisitWindows.$inferSelect)[]>();
  windows.forEach((window) => {
    const patientWindows = windowsByPatientId.get(window.patientId) ?? [];
    patientWindows.push(window);
    windowsByPatientId.set(window.patientId, patientWindows);
  });

  return patientRows.map((patient) => ({
    ...patient,
    visitWindows: windowsByPatientId.get(patient.id) ?? [],
  }));
};

export const listPatientsByNurse = async (
  nurseId: string,
  options: { query?: string; state?: PatientLifecycleState } = {},
) => {
  const { query, state = "active" } = options;
  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - SCHEDULING_INACTIVITY_WINDOW_DAYS * DAY_MS);

  const filters = [eq(patients.nurseId, nurseId)];
  if (state === "archived") {
    // Only archived rows from the last ARCHIVED_VISIBILITY_DAYS are user-visible;
    // older ones are retained in the DB but never surfaced.
    const archivedCutoff = new Date(now.getTime() - ARCHIVED_VISIBILITY_DAYS * DAY_MS);
    filters.push(eq(patients.isActive, false), gte(patients.archivedAt, archivedCutoff));
  } else if (state === "idle") {
    filters.push(eq(patients.isActive, true), idleCondition(inactivityCutoff)!);
  } else if (state === "schedulable") {
    // Active + idle (everything except archived). The Route Planner uses this so
    // an idle client (>30d unscheduled) is still selectable; scheduling them
    // re-activates them. No recency condition — only archived rows are excluded.
    filters.push(eq(patients.isActive, true));
  } else {
    filters.push(eq(patients.isActive, true), activeCondition(inactivityCutoff)!);
  }

  const normalizedQuery = query?.trim() ?? "";
  if (normalizedQuery.length > 0) {
    const searchTerm = `%${normalizedQuery}%`;
    filters.push(or(ilike(patients.firstName, searchTerm), ilike(patients.lastName, searchTerm))!);
  }

  const orderBy =
    state === "archived"
      ? [desc(patients.archivedAt)]
      : [asc(patients.lastName), asc(patients.firstName), asc(patients.createdAt)];

  const patientRows = await getDb()
    .select()
    .from(patients)
    .where(and(...filters))
    .orderBy(...orderBy);

  return attachVisitWindows(patientRows);
};

export const createPatientForNurse = async (nurseId: string, payload: CreatePatientRequest) => {
  return runInTransaction(async (transaction) => {
    const primaryWindow = payload.visitWindows[0] ?? {
      startTime: FALLBACK_FLEXIBLE_START_TIME,
      endTime: FALLBACK_FLEXIBLE_END_TIME,
      visitTimeType: FALLBACK_FLEXIBLE_VISIT_TYPE,
    };

    const [patient] = await transaction
      .insert(patients)
      .values({
        nurseId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        address: payload.address,
        googlePlaceId: payload.googlePlaceId ?? null,
        visitDurationMinutes: payload.visitDurationMinutes,
        preferredVisitStartTime: primaryWindow.startTime,
        preferredVisitEndTime: primaryWindow.endTime,
        visitTimeType: primaryWindow.visitTimeType,
      })
      .returning();

    const insertedWindows =
      payload.visitWindows.length > 0
        ? await transaction
            .insert(patientVisitWindows)
            .values(
              payload.visitWindows.map((window) => ({
                patientId: patient.id,
                startTime: window.startTime,
                endTime: window.endTime,
                visitTimeType: window.visitTimeType,
              })),
            )
            .returning()
        : [];

    return {
      ...patient,
      visitWindows: insertedWindows,
    };
  });
};

export const findPatientByIdForNurse = async (nurseId: string, patientId: string) => {
  const [patient] = await getDb()
    .select()
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
    .limit(1);

  if (!patient) {
    return null;
  }

  const [withWindows] = await attachVisitWindows([patient]);
  return withWindows ?? null;
};

export const updatePatientForNurse = async (
  nurseId: string,
  patientId: string,
  payload: UpdatePatientRequest,
) => {
  const existingPatient = await findPatientByIdForNurse(nurseId, patientId);
  if (!existingPatient) {
    return null;
  }

  const nextGooglePlaceId =
    payload.googlePlaceId !== undefined
      ? payload.googlePlaceId
      : payload.address !== undefined && payload.address !== existingPatient.address
        ? null
        : existingPatient.googlePlaceId;

  return runInTransaction(async (transaction) => {
    const nextVisitWindows = payload.visitWindows;
    const hasVisitWindowsUpdate = nextVisitWindows !== undefined;
    const primaryWindow = hasVisitWindowsUpdate
      ? (nextVisitWindows[0] ?? {
          startTime: FALLBACK_FLEXIBLE_START_TIME,
          endTime: FALLBACK_FLEXIBLE_END_TIME,
          visitTimeType: FALLBACK_FLEXIBLE_VISIT_TYPE,
        })
      : undefined;

    const [updatedPatient] = await transaction
      .update(patients)
      .set({
        ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
        ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
        googlePlaceId: nextGooglePlaceId,
        ...(payload.visitDurationMinutes !== undefined
          ? { visitDurationMinutes: payload.visitDurationMinutes }
          : {}),
        ...(hasVisitWindowsUpdate && primaryWindow
          ? {
              preferredVisitStartTime: primaryWindow.startTime,
              preferredVisitEndTime: primaryWindow.endTime,
              visitTimeType: primaryWindow.visitTimeType,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
      .returning();

    if (!updatedPatient) {
      return null;
    }

    let nextWindows = existingPatient.visitWindows;
    if (nextVisitWindows !== undefined) {
      await transaction
        .delete(patientVisitWindows)
        .where(eq(patientVisitWindows.patientId, updatedPatient.id));

      nextWindows =
        nextVisitWindows.length > 0
          ? await transaction
              .insert(patientVisitWindows)
              .values(
                nextVisitWindows.map((window) => ({
                  patientId: updatedPatient.id,
                  startTime: window.startTime,
                  endTime: window.endTime,
                  visitTimeType: window.visitTimeType,
                })),
              )
              .returning()
          : [];
    }

    return {
      ...updatedPatient,
      visitWindows: nextWindows,
    };
  });
};

// Archive (soft-delete) a single client, scoped to the nurse. Stamps archived_at
// so the 7-day visibility window starts now.
export const deletePatientForNurse = async (nurseId: string, patientId: string) => {
  const [deletedPatient] = await getDb()
    .update(patients)
    .set({
      isActive: false,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(patients.id, patientId), eq(patients.nurseId, nurseId), eq(patients.isActive, true)),
    )
    .returning({ id: patients.id });

  return deletedPatient ?? null;
};

// Restore an archived client back to active. Only works while still visible
// (archived within ARCHIVED_VISIBILITY_DAYS); older rows aren't user-reachable.
export const restorePatientForNurse = async (nurseId: string, patientId: string) => {
  const now = new Date();
  const archivedCutoff = new Date(now.getTime() - ARCHIVED_VISIBILITY_DAYS * DAY_MS);

  const [restored] = await getDb()
    .update(patients)
    .set({ isActive: true, archivedAt: null, updatedAt: now })
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, false),
        gte(patients.archivedAt, archivedCutoff),
      ),
    )
    .returning();

  if (!restored) {
    return null;
  }

  const [withWindows] = await attachVisitWindows([restored]);
  return withWindows ?? null;
};

// Count of idle (active, unused 30+ days) clients — used by the dashboard
// "Idle clients" nudge. Matches the Idle tab's set.
export const countStaleClientsForNurse = async (nurseId: string): Promise<number> => {
  const inactivityCutoff = new Date(Date.now() - SCHEDULING_INACTIVITY_WINDOW_DAYS * DAY_MS);

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(patients)
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, true),
        idleCondition(inactivityCutoff)!,
      ),
    );

  return row?.count ?? 0;
};

// Counts per lifecycle state for the Clients-page tabs (active / idle / archived,
// archived limited to the 7-day visibility window).
export const countPatientsByStateForNurse = async (nurseId: string) => {
  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - SCHEDULING_INACTIVITY_WINDOW_DAYS * DAY_MS);
  const archivedCutoff = new Date(now.getTime() - ARCHIVED_VISIBILITY_DAYS * DAY_MS);

  const countWhere = async (condition: ReturnType<typeof and>) => {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(condition);
    return row?.count ?? 0;
  };

  const active = await countWhere(
    and(
      eq(patients.nurseId, nurseId),
      eq(patients.isActive, true),
      activeCondition(inactivityCutoff)!,
    ),
  );
  const idle = await countWhere(
    and(
      eq(patients.nurseId, nurseId),
      eq(patients.isActive, true),
      idleCondition(inactivityCutoff)!,
    ),
  );
  const archived = await countWhere(
    and(
      eq(patients.nurseId, nurseId),
      eq(patients.isActive, false),
      gte(patients.archivedAt, archivedCutoff),
    ),
  );

  return { active, idle, archived };
};

// Bulk archive the given clients, scoped to the nurse. Stamps archived_at.
// Returns the ids actually archived (already-inactive or other nurses' ids ignored).
export const archivePatientsForNurse = async (nurseId: string, patientIds: string[]) => {
  if (patientIds.length === 0) {
    return [];
  }

  const now = new Date();
  const archived = await getDb()
    .update(patients)
    .set({ isActive: false, archivedAt: now, updatedAt: now })
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, true),
        inArray(patients.id, patientIds),
      ),
    )
    .returning({ id: patients.id });

  return archived.map((row) => row.id);
};

// "Permanent delete" (soft): push archived_at to the epoch sentinel so the row
// falls outside the ARCHIVED_VISIBILITY_DAYS window forever — invisible in every
// tab and no longer restorable from the UI, while the row is retained in the DB.
// Only acts on already-archived rows scoped to the nurse.
export const permanentlyDeletePatientsForNurse = async (nurseId: string, patientIds: string[]) => {
  if (patientIds.length === 0) {
    return [];
  }

  const now = new Date();
  const deleted = await getDb()
    .update(patients)
    .set({ isActive: false, archivedAt: new Date(0), updatedAt: now })
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, false),
        inArray(patients.id, patientIds),
      ),
    )
    .returning({ id: patients.id });

  return deleted.map((row) => row.id);
};
