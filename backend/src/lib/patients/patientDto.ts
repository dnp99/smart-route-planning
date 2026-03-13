import type { PatientVisitWindow } from "../../db/schema";
import type { Patient as PatientContract, VisitTimeType } from "../../../../shared/contracts";
import type { PatientWithVisitWindows } from "./patientRepository";

const toHourMinute = (value: string) => value.slice(0, 5);

const toVisitTimeType = (value: string): VisitTimeType =>
  value === "flexible" ? "flexible" : "fixed";

const toVisitWindowDto = (window: PatientVisitWindow) => ({
  id: window.id,
  startTime: toHourMinute(window.startTime),
  endTime: toHourMinute(window.endTime),
  visitTimeType: toVisitTimeType(window.visitTimeType),
});

export const toPatientDto = (patient: PatientWithVisitWindows): PatientContract => {
  const visitWindows = (Array.isArray(patient.visitWindows) ? patient.visitWindows : []).map(
    toVisitWindowDto,
  );

  return {
    id: patient.id,
    nurseId: patient.nurseId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    address: patient.address,
    googlePlaceId: patient.googlePlaceId,
    preferredVisitStartTime: toHourMinute(patient.preferredVisitStartTime),
    preferredVisitEndTime: toHourMinute(patient.preferredVisitEndTime),
    visitTimeType: toVisitTimeType(patient.visitTimeType),
    visitWindows,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
};
