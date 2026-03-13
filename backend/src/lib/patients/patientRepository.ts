import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "../../db";
import { nurses, patients } from "../../db/schema";
import type { CreatePatientRequest, UpdatePatientRequest } from "../../../../shared/contracts";
import { validateTimeWindow } from "./patientValidation";

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

export const listPatientsByNurse = async (nurseId: string, query?: string) => {
  const normalizedQuery = query?.trim() ?? "";

  const filters = [eq(patients.nurseId, nurseId)];
  if (normalizedQuery.length > 0) {
    const searchTerm = `%${normalizedQuery}%`;
    filters.push(or(ilike(patients.firstName, searchTerm), ilike(patients.lastName, searchTerm))!);
  }

  return getDb()
    .select()
    .from(patients)
    .where(and(...filters))
    .orderBy(asc(patients.lastName), asc(patients.firstName), asc(patients.createdAt));
};

export const createPatientForNurse = async (nurseId: string, payload: CreatePatientRequest) => {
  const [patient] = await getDb()
    .insert(patients)
    .values({
      nurseId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      address: payload.address,
      googlePlaceId: payload.googlePlaceId ?? null,
      preferredVisitStartTime: payload.preferredVisitStartTime,
      preferredVisitEndTime: payload.preferredVisitEndTime,
      visitTimeType: payload.visitTimeType,
    })
    .returning();

  return patient;
};

export const findPatientByIdForNurse = async (nurseId: string, patientId: string) => {
  const [patient] = await getDb()
    .select()
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
    .limit(1);

  return patient ?? null;
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

  const nextStartTime = payload.preferredVisitStartTime ?? existingPatient.preferredVisitStartTime;
  const nextEndTime = payload.preferredVisitEndTime ?? existingPatient.preferredVisitEndTime;
  validateTimeWindow(nextStartTime.slice(0, 5), nextEndTime.slice(0, 5));

  const nextGooglePlaceId =
    payload.googlePlaceId !== undefined
      ? payload.googlePlaceId
      : payload.address !== undefined && payload.address !== existingPatient.address
        ? null
        : existingPatient.googlePlaceId;

  const [updatedPatient] = await getDb()
    .update(patients)
    .set({
      ...payload,
      googlePlaceId: nextGooglePlaceId,
      updatedAt: new Date(),
    })
    .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
    .returning();

  return updatedPatient ?? null;
};

export const deletePatientForNurse = async (nurseId: string, patientId: string) => {
  const [deletedPatient] = await getDb()
    .delete(patients)
    .where(and(eq(patients.id, patientId), eq(patients.nurseId, nurseId)))
    .returning({ id: patients.id });

  return deletedPatient ?? null;
};
