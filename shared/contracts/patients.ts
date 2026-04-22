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

export type RecurringVisitTemplateWindow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type RecurringVisitTemplateWindowInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type RecurringVisitTemplate = {
  id: string;
  nurseId: string;
  patientId: string;
  name: string | null;
  timezone: string;
  recurrenceRule: string;
  startDate: string;
  endDate: string | null;
  serviceDurationMinutes: number;
  isActive: boolean;
  windows: RecurringVisitTemplateWindow[];
  createdAt: string;
  updatedAt: string;
};

export type VisitInstanceStatus = "scheduled" | "cancelled";

export type VisitInstance = {
  id: string;
  nurseId: string;
  patientId: string;
  templateId: string | null;
  occurrenceKey: string;
  planningDate: string;
  address: string;
  googlePlaceId: string | null;
  windowStart: string;
  windowEnd: string;
  visitTimeType: VisitTimeType;
  serviceDurationMinutes: number;
  status: VisitInstanceStatus;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VisitInstanceExceptionAction = "skip" | "reschedule" | "edit";

export type VisitInstanceException = {
  id: string;
  nurseId: string;
  visitInstanceId: string;
  templateId: string | null;
  exceptionDate: string;
  action: VisitInstanceExceptionAction;
  rescheduledDate: string | null;
  overrideStartTime: string | null;
  overrideEndTime: string | null;
  overrideVisitTimeType: VisitTimeType | null;
  overrideServiceDurationMinutes: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  recurringVisitTemplates?: RecurringVisitTemplate[];
  createdAt: string;
  updatedAt: string;
};

export type ListRecurringVisitTemplatesResponse = {
  templates: RecurringVisitTemplate[];
};

export type CreateRecurringVisitTemplateRequest = {
  patientId: string;
  name?: string | null;
  timezone: string;
  recurrenceRule: string;
  startDate: string;
  endDate?: string | null;
  serviceDurationMinutes: number;
  windows: RecurringVisitTemplateWindowInput[];
};

export type UpdateRecurringVisitTemplateRequest = Partial<CreateRecurringVisitTemplateRequest> & {
  isActive?: boolean;
};

export type ListVisitInstancesResponse = {
  instances: VisitInstance[];
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

export const isRecurringVisitTemplateWindow = (
  value: unknown,
): value is RecurringVisitTemplateWindow => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.dayOfWeek === "number" &&
    Number.isInteger(value.dayOfWeek) &&
    value.dayOfWeek >= 0 &&
    value.dayOfWeek <= 6 &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    isVisitTimeType(value.visitTimeType)
  );
};

export const isRecurringVisitTemplate = (value: unknown): value is RecurringVisitTemplate => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.nurseId === "string" &&
    typeof value.patientId === "string" &&
    (typeof value.name === "string" || value.name === null) &&
    typeof value.timezone === "string" &&
    typeof value.recurrenceRule === "string" &&
    typeof value.startDate === "string" &&
    (typeof value.endDate === "string" || value.endDate === null) &&
    isVisitDurationMinutes(value.serviceDurationMinutes) &&
    typeof value.isActive === "boolean" &&
    Array.isArray(value.windows) &&
    value.windows.every((window) => isRecurringVisitTemplateWindow(window)) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

export const parseListRecurringVisitTemplatesResponse = (
  payload: unknown,
): ListRecurringVisitTemplatesResponse => {
  if (!isObject(payload) || !Array.isArray(payload.templates)) {
    return { templates: [] };
  }

  return {
    templates: payload.templates.filter((template): template is RecurringVisitTemplate =>
      isRecurringVisitTemplate(template),
    ),
  };
};

export const isVisitInstance = (value: unknown): value is VisitInstance => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.nurseId === "string" &&
    typeof value.patientId === "string" &&
    (typeof value.templateId === "string" || value.templateId === null) &&
    typeof value.occurrenceKey === "string" &&
    typeof value.planningDate === "string" &&
    typeof value.address === "string" &&
    (typeof value.googlePlaceId === "string" || value.googlePlaceId === null) &&
    typeof value.windowStart === "string" &&
    typeof value.windowEnd === "string" &&
    isVisitTimeType(value.visitTimeType) &&
    isVisitDurationMinutes(value.serviceDurationMinutes) &&
    (value.status === "scheduled" || value.status === "cancelled") &&
    typeof value.isManualOverride === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

export const parseListVisitInstancesResponse = (payload: unknown): ListVisitInstancesResponse => {
  if (!isObject(payload) || !Array.isArray(payload.instances)) {
    return { instances: [] };
  }

  return {
    instances: payload.instances.filter((instance): instance is VisitInstance => isVisitInstance(instance)),
  };
};
