import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "../../db";
import { nurses, patientVisitWindows, patients } from "../../db/schema";
import type { CreatePatientRequest, UpdatePatientRequest } from "../../../../shared/contracts";

export class NurseEmailConflictError extends Error {
  constructor(message = "An account with this email already exists.") {
    super(message);
    this.name = "NurseEmailConflictError";
  }
}

const FALLBACK_FLEXIBLE_START_TIME = "00:00";
const FALLBACK_FLEXIBLE_END_TIME = "23:59";
const FALLBACK_FLEXIBLE_VISIT_TYPE = "flexible";

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

export const listPatientsByNurse = async (nurseId: string, query?: string) => {
  const normalizedQuery = query?.trim() ?? "";

  const filters = [eq(patients.nurseId, nurseId)];
  if (normalizedQuery.length > 0) {
    const searchTerm = `%${normalizedQuery}%`;
    filters.push(or(ilike(patients.firstName, searchTerm), ilike(patients.lastName, searchTerm))!);
  }

  const patientRows = await getDb()
    .select()
    .from(patients)
    .where(and(...filters))
    .orderBy(asc(patients.lastName), asc(patients.firstName), asc(patients.createdAt));

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

export const deletePatientForNurse = async (nurseId: string, patientId: string) => {
  const [deletedPatient] = await getDb()
    .delete(patients)
    .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
    .returning({ id: patients.id });

  return deletedPatient ?? null;
};
