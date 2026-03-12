import type { Patient } from "../../db/schema";
import type { Patient as PatientContract } from "../../../../shared/contracts";

const toHourMinute = (value: string) => value.slice(0, 5);

export const toPatientDto = (patient: Patient): PatientContract => ({
  id: patient.id,
  nurseId: patient.nurseId,
  firstName: patient.firstName,
  lastName: patient.lastName,
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
  preferredVisitStartTime: toHourMinute(patient.preferredVisitStartTime),
  preferredVisitEndTime: toHourMinute(patient.preferredVisitEndTime),
  visitTimeType: patient.visitTimeType === "flexible" ? "flexible" : "fixed",
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
});
