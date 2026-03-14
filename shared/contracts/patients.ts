const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type VisitTimeType = "fixed" | "flexible";

export type PatientVisitWindow = {
  id: string;
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type PatientVisitWindowInput = {
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type Patient = {
  id: string;
  nurseId: string;
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  visitDurationMinutes: number;
  // Legacy single-window fields kept for compatibility.
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: VisitTimeType;
  visitWindows: PatientVisitWindow[];
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
  visitDurationMinutes: number;
  visitWindows: PatientVisitWindowInput[];
};

export type UpdatePatientRequest = Partial<Omit<CreatePatientRequest, "visitWindows">> & {
  visitWindows?: PatientVisitWindowInput[];
};

export type DeletePatientResponse = {
  deleted: true;
  id: string;
};

export const isVisitTimeType = (value: unknown): value is VisitTimeType =>
  value === "fixed" || value === "flexible";

const isVisitDurationMinutes = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 180;

const isPatientVisitWindow = (value: unknown): value is PatientVisitWindow => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    isVisitTimeType(value.visitTimeType)
  );
};

const toFallbackVisitWindow = (value: Record<string, unknown>): PatientVisitWindow | null => {
  if (
    typeof value.id !== "string" ||
    typeof value.preferredVisitStartTime !== "string" ||
    typeof value.preferredVisitEndTime !== "string" ||
    !isVisitTimeType(value.visitTimeType)
  ) {
    return null;
  }

  return {
    id: `${value.id}-legacy`,
    startTime: value.preferredVisitStartTime,
    endTime: value.preferredVisitEndTime,
    visitTimeType: value.visitTimeType,
  };
};

export const isPatient = (value: unknown): value is Patient => {
  if (!isObject(value)) {
    return false;
  }

  const fallbackVisitWindow = toFallbackVisitWindow(value);
  const visitWindows =
    Array.isArray(value.visitWindows) && value.visitWindows.every((window) => isPatientVisitWindow(window))
      ? value.visitWindows
      : value.visitWindows === undefined
        ? fallbackVisitWindow
          ? [fallbackVisitWindow]
          : null
        : null;

  return (
    typeof value.id === "string" &&
    typeof value.nurseId === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.address === "string" &&
    (value.googlePlaceId === null || typeof value.googlePlaceId === "string") &&
    isVisitDurationMinutes(value.visitDurationMinutes) &&
    Array.isArray(visitWindows) &&
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

  const toPatient = (value: unknown): Patient | null => {
    if (!isPatient(value)) {
      return null;
    }

    const patient = value as Patient;
    if (Array.isArray(patient.visitWindows)) {
      return patient;
    }

    return {
      ...patient,
      visitWindows: [
        {
          id: `${patient.id}-legacy`,
          startTime: patient.preferredVisitStartTime,
          endTime: patient.preferredVisitEndTime,
          visitTimeType: patient.visitTimeType,
        },
      ],
    };
  };

  return {
    patients: payload.patients.map(toPatient).filter((patient): patient is Patient => patient !== null),
  };
};
