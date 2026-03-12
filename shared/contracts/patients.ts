const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type VisitTimeType = "fixed" | "flexible";

export type Patient = {
  id: string;
  nurseId: string;
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: VisitTimeType;
  createdAt: string;
  updatedAt: string;
};

export type ListPatientsResponse = {
  patients: Patient[];
};

export type CreatePatientRequest = {
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId?: string | null;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: VisitTimeType;
};

export type UpdatePatientRequest = Partial<CreatePatientRequest>;

export type DeletePatientResponse = {
  deleted: true;
  id: string;
};

export const isVisitTimeType = (value: unknown): value is VisitTimeType =>
  value === "fixed" || value === "flexible";

export const isPatient = (value: unknown): value is Patient => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.nurseId === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.address === "string" &&
    (value.googlePlaceId === null || typeof value.googlePlaceId === "string") &&
    typeof value.preferredVisitStartTime === "string" &&
    typeof value.preferredVisitEndTime === "string" &&
    isVisitTimeType(value.visitTimeType) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

export const parseListPatientsResponse = (payload: unknown): ListPatientsResponse => {
  if (!isObject(payload) || !Array.isArray(payload.patients)) {
    return { patients: [] };
  }

  return {
    patients: payload.patients.filter(isPatient),
  };
};
