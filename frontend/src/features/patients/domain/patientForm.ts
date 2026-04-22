import type {
  CreatePatientRequest,
  CreateRecurringVisitTemplateRequest,
  Patient,
  RecurringVisitTemplate,
  UpdateRecurringVisitTemplateRequest,
  VisitTimeType,
} from "../../../../../shared/contracts";
import { formatPatientNameFromParts } from "./patientName";

export type PatientFormVisitWindow = {
  id: string;
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type PatientFormValues = {
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  visitDurationMinutes: number;
  visitWindows: PatientFormVisitWindow[];
  recurringTemplates: PatientFormRecurringTemplate[];
};

export type PatientFormRecurringTemplateWindow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  visitTimeType: VisitTimeType;
};

export type PatientFormRecurringTemplate = {
  id: string;
  templateId: string | null;
  name: string;
  timezone: string;
  recurrenceRule: string;
  startDate: string;
  endDate: string;
  serviceDurationMinutes: number;
  isActive: boolean;
  windows: PatientFormRecurringTemplateWindow[];
};

export type FormMode = "create" | "edit";
export type VisitWindowFieldErrors = {
  startTime?: string;
  endTime?: string;
  visitTimeType?: string;
};

export type RecurringTemplateWindowFieldErrors = {
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  visitTimeType?: string;
};

export type RecurringTemplateFieldErrors = {
  name?: string;
  timezone?: string;
  recurrenceRule?: string;
  startDate?: string;
  endDate?: string;
  serviceDurationMinutes?: string;
  windows?: string;
  windowRows?: RecurringTemplateWindowFieldErrors[];
};

export type FormFieldErrors = {
  firstName?: string;
  lastName?: string;
  address?: string;
  visitDurationMinutes?: string;
  visitWindows?: string;
  visitWindowRows?: VisitWindowFieldErrors[];
  recurringTemplates?: string;
  recurringTemplateRows?: RecurringTemplateFieldErrors[];
};

export const MIN_VISIT_DURATION_MINUTES = 1;
export const MAX_VISIT_DURATION_MINUTES = 180;
export const DEFAULT_VISIT_DURATION_MINUTES = 30;
export const DEFAULT_RECURRING_TEMPLATE_TIMEZONE = "America/Toronto";
export const DEFAULT_RECURRING_RULE = "FREQ=WEEKLY;INTERVAL=1";

type RecurringTemplateMutationPlan = {
  create: CreateRecurringVisitTemplateRequest[];
  update: Array<{ templateId: string; request: UpdateRecurringVisitTemplateRequest }>;
  remove: string[];
};

const createWindowId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `window-${Math.random().toString(36).slice(2, 10)}`;
};

const toHourMinute = (minutes: number) => {
  const normalized = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const mins = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

export const getDefaultVisitWindowTimes = (position = 0) => {
  const slotMinutes = Math.max(0, position) * 60;
  const startTime = toHourMinute(9 * 60 + slotMinutes);
  const endTime = toHourMinute(Math.min(23 * 60 + 59, 10 * 60 + slotMinutes));

  return { startTime, endTime };
};

export const createEmptyVisitWindow = (
  visitTimeType: VisitTimeType = "fixed",
  position = 0,
): PatientFormVisitWindow => {
  const { startTime, endTime } = getDefaultVisitWindowTimes(position);

  return {
    id: createWindowId(),
    startTime,
    endTime,
    visitTimeType,
  };
};

export const createEmptyRecurringTemplateWindow = (
  position = 0,
): PatientFormRecurringTemplateWindow => {
  const dayOfWeek = Math.max(0, Math.min(position, 6));
  const { startTime, endTime } = getDefaultVisitWindowTimes(position);

  return {
    id: createWindowId(),
    dayOfWeek,
    startTime,
    endTime,
    visitTimeType: "fixed",
  };
};

export const createEmptyRecurringTemplate = (
  serviceDurationMinutes = DEFAULT_VISIT_DURATION_MINUTES,
): PatientFormRecurringTemplate => ({
  id: createWindowId(),
  templateId: null,
  name: "",
  timezone: DEFAULT_RECURRING_TEMPLATE_TIMEZONE,
  recurrenceRule: DEFAULT_RECURRING_RULE,
  startDate: "",
  endDate: "",
  serviceDurationMinutes,
  isActive: true,
  windows: [createEmptyRecurringTemplateWindow(1)],
});

export const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  address: "",
  googlePlaceId: null,
  visitDurationMinutes: DEFAULT_VISIT_DURATION_MINUTES,
  visitWindows: [createEmptyVisitWindow()],
  recurringTemplates: [],
};

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

export const toTimeInput = (value: string) => value.slice(0, 5);

const getPatientVisitWindows = (patient: Patient) =>
  Array.isArray(patient.visitWindows) ? patient.visitWindows : [];

const formatWindowRange = (startTime: string, endTime: string) =>
  `${toTimeInput(startTime)}\u00A0-\u00A0${toTimeInput(endTime)}`;

const toRecurringFormTemplate = (
  template: RecurringVisitTemplate,
): PatientFormRecurringTemplate => ({
  id: template.id,
  templateId: template.id,
  name: template.name ?? "",
  timezone: template.timezone,
  recurrenceRule: template.recurrenceRule,
  startDate: template.startDate,
  endDate: template.endDate ?? "",
  serviceDurationMinutes: template.serviceDurationMinutes,
  isActive: template.isActive,
  windows: template.windows.map((window) => ({
    id: window.id,
    dayOfWeek: window.dayOfWeek,
    startTime: toTimeInput(window.startTime),
    endTime: toTimeInput(window.endTime),
    visitTimeType: window.visitTimeType,
  })),
});

export const toFormValues = (
  patient: Patient,
  recurringTemplates: RecurringVisitTemplate[] = patient.recurringVisitTemplates ?? [],
): PatientFormValues => ({
  firstName: patient.firstName,
  lastName: patient.lastName,
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
  visitDurationMinutes: patient.visitDurationMinutes,
  visitWindows:
    getPatientVisitWindows(patient).length > 0
      ? getPatientVisitWindows(patient).map((window) => ({
          id: window.id,
          startTime: toTimeInput(window.startTime),
          endTime: toTimeInput(window.endTime),
          visitTimeType: window.visitTimeType,
        }))
      : patient.visitTimeType === "flexible"
        ? []
        : [
            {
              id: createWindowId(),
              startTime: toTimeInput(patient.preferredVisitStartTime),
              endTime: toTimeInput(patient.preferredVisitEndTime),
              visitTimeType: patient.visitTimeType,
            },
          ],
  recurringTemplates: recurringTemplates.map(toRecurringFormTemplate),
});

export const formatTimeWindow = (patient: Patient) =>
  (getPatientVisitWindows(patient).length > 0
    ? getPatientVisitWindows(patient).map((window) =>
        formatWindowRange(window.startTime, window.endTime),
      )
    : patient.visitTimeType === "flexible"
      ? ["Not set"]
      : [formatWindowRange(patient.preferredVisitStartTime, patient.preferredVisitEndTime)]
  ).join(", ");

export const getPatientDisplayName = (patient: Patient) =>
  formatPatientNameFromParts(patient.firstName, patient.lastName);

export const toCreateRequest = (values: PatientFormValues): CreatePatientRequest => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  address: values.address.trim(),
  googlePlaceId: values.googlePlaceId,
  visitDurationMinutes: values.visitDurationMinutes,
  visitWindows: values.visitWindows.map((window) => ({
    startTime: window.startTime,
    endTime: window.endTime,
    visitTimeType: window.visitTimeType,
  })),
});

export const buildRecurringTemplateMutationPlan = (
  patientId: string,
  values: PatientFormValues,
  existingTemplates: RecurringVisitTemplate[],
): RecurringTemplateMutationPlan => {
  const existingById = new Map(existingTemplates.map((template) => [template.id, template]));

  const create: CreateRecurringVisitTemplateRequest[] = [];
  const update: Array<{ templateId: string; request: UpdateRecurringVisitTemplateRequest }> = [];

  values.recurringTemplates.forEach((template) => {
    const normalizedWindows = template.windows.map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
      visitTimeType: window.visitTimeType,
    }));

    const normalizedRequestBase = {
      patientId,
      name: template.name.trim() || null,
      timezone: template.timezone.trim(),
      recurrenceRule: template.recurrenceRule.trim(),
      startDate: template.startDate.trim(),
      endDate: template.endDate.trim() || null,
      serviceDurationMinutes: template.serviceDurationMinutes,
      windows: normalizedWindows,
    };

    if (!template.templateId) {
      create.push(normalizedRequestBase);
      return;
    }

    const existing = existingById.get(template.templateId);
    if (!existing) {
      create.push(normalizedRequestBase);
      return;
    }

    update.push({
      templateId: template.templateId,
      request: {
        ...normalizedRequestBase,
        isActive: template.isActive,
      },
    });
  });

  const currentTemplateIds = new Set(
    values.recurringTemplates
      .map((template) => template.templateId)
      .filter((templateId): templateId is string => typeof templateId === "string"),
  );
  const remove = existingTemplates
    .map((template) => template.id)
    .filter((templateId) => !currentTemplateIds.has(templateId));

  return {
    create,
    update,
    remove,
  };
};

const resolvePatientValidationName = (values: PatientFormValues) => {
  const patientName = formatPatientNameFromParts(values.firstName, values.lastName);
  if (patientName.length > 0) {
    return patientName;
  }

  return "Client";
};

export const validateForm = (values: PatientFormValues): FormFieldErrors => {
  const errors: FormFieldErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!values.address.trim()) {
    errors.address = "Address is required.";
  }

  if (
    !Number.isInteger(values.visitDurationMinutes) ||
    values.visitDurationMinutes < MIN_VISIT_DURATION_MINUTES ||
    values.visitDurationMinutes > MAX_VISIT_DURATION_MINUTES
  ) {
    errors.visitDurationMinutes = `Visit duration must be an integer between ${MIN_VISIT_DURATION_MINUTES} and ${MAX_VISIT_DURATION_MINUTES} minutes.`;
  }

  if (values.visitWindows.length === 0) {
    return errors;
  }

  const visitWindowRows: VisitWindowFieldErrors[] = values.visitWindows.map(() => ({}));
  const patientValidationName = resolvePatientValidationName(values);
  values.visitWindows.forEach((window, index) => {
    if (!HH_MM_PATTERN.test(window.startTime)) {
      visitWindowRows[index].startTime = "Start time must use HH:MM 24-hour format.";
    }

    if (!HH_MM_PATTERN.test(window.endTime)) {
      visitWindowRows[index].endTime = "End time must use HH:MM 24-hour format.";
    }

    if (visitWindowRows[index].startTime || visitWindowRows[index].endTime) {
      return;
    }

    const startMinutes = timeToMinutes(window.startTime);
    const endMinutes = timeToMinutes(window.endTime);

    if (endMinutes <= startMinutes) {
      visitWindowRows[index].endTime =
        "End time must be later than start time (cross-midnight windows are not supported).";
      return;
    }

    if (
      !errors.visitDurationMinutes &&
      window.visitTimeType === "fixed" &&
      endMinutes - startMinutes < values.visitDurationMinutes
    ) {
      const minuteLabel = values.visitDurationMinutes === 1 ? "minute" : "minutes";
      visitWindowRows[index].endTime =
        `${patientValidationName} fixed window must be at least ${values.visitDurationMinutes} ${minuteLabel} long as per client's profile.`;
    }
  });

  if (visitWindowRows.some((entry) => Object.keys(entry).length > 0)) {
    errors.visitWindowRows = visitWindowRows;
  }

  if (values.recurringTemplates.length > 0) {
    const recurringTemplateRows: RecurringTemplateFieldErrors[] = values.recurringTemplates.map(
      () => ({}),
    );

    values.recurringTemplates.forEach((template, templateIndex) => {
      const row = recurringTemplateRows[templateIndex];

      if (!template.timezone.trim()) {
        row.timezone = "Timezone is required.";
      } else {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: template.timezone.trim() }).format(
            new Date(),
          );
        } catch {
          row.timezone = "Timezone must be a valid IANA timezone.";
        }
      }

      if (!template.recurrenceRule.trim()) {
        row.recurrenceRule = "Recurrence rule is required.";
      }

      if (!DATE_PATTERN.test(template.startDate.trim())) {
        row.startDate = "Start date must use YYYY-MM-DD format.";
      }

      if (template.endDate.trim().length > 0 && !DATE_PATTERN.test(template.endDate.trim())) {
        row.endDate = "End date must use YYYY-MM-DD format.";
      }

      if (
        DATE_PATTERN.test(template.startDate.trim()) &&
        DATE_PATTERN.test(template.endDate.trim()) &&
        template.endDate.trim() < template.startDate.trim()
      ) {
        row.endDate = "End date must be on or after start date.";
      }

      if (
        !Number.isInteger(template.serviceDurationMinutes) ||
        template.serviceDurationMinutes < MIN_VISIT_DURATION_MINUTES ||
        template.serviceDurationMinutes > MAX_VISIT_DURATION_MINUTES
      ) {
        row.serviceDurationMinutes = `Service duration must be an integer between ${MIN_VISIT_DURATION_MINUTES} and ${MAX_VISIT_DURATION_MINUTES} minutes.`;
      }

      if (template.windows.length === 0) {
        row.windows = "Add at least one recurring window.";
      } else {
        const windowRows: RecurringTemplateWindowFieldErrors[] = template.windows.map(() => ({}));
        template.windows.forEach((window, windowIndex) => {
          if (!Number.isInteger(window.dayOfWeek) || window.dayOfWeek < 0 || window.dayOfWeek > 6) {
            windowRows[windowIndex].dayOfWeek =
              "Day must be an integer from 0 (Sunday) to 6 (Saturday).";
          }

          if (!HH_MM_PATTERN.test(window.startTime)) {
            windowRows[windowIndex].startTime = "Start time must use HH:MM 24-hour format.";
          }

          if (!HH_MM_PATTERN.test(window.endTime)) {
            windowRows[windowIndex].endTime = "End time must use HH:MM 24-hour format.";
          }

          if (windowRows[windowIndex].startTime || windowRows[windowIndex].endTime) {
            return;
          }

          const startMinutes = timeToMinutes(window.startTime);
          const endMinutes = timeToMinutes(window.endTime);
          if (endMinutes <= startMinutes) {
            windowRows[windowIndex].endTime =
              "End time must be later than start time (cross-midnight windows are not supported).";
            return;
          }

          if (
            !row.serviceDurationMinutes &&
            window.visitTimeType === "fixed" &&
            endMinutes - startMinutes < template.serviceDurationMinutes
          ) {
            const minuteLabel = template.serviceDurationMinutes === 1 ? "minute" : "minutes";
            windowRows[windowIndex].endTime =
              `Template fixed window must be at least ${template.serviceDurationMinutes} ${minuteLabel} long.`;
          }
        });

        if (windowRows.some((entry) => Object.keys(entry).length > 0)) {
          row.windowRows = windowRows;
        }
      }
    });

    if (recurringTemplateRows.some((entry) => Object.keys(entry).length > 0)) {
      errors.recurringTemplateRows = recurringTemplateRows;
    }
  }

  return errors;
};
