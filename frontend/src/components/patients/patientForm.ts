import type {
  CreatePatientRequest,
  Patient,
  VisitTimeType,
} from "../../../../shared/contracts";
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
};

export type FormMode = "create" | "edit";
export type VisitWindowFieldErrors = {
  startTime?: string;
  endTime?: string;
  visitTimeType?: string;
};

export type FormFieldErrors = {
  firstName?: string;
  lastName?: string;
  address?: string;
  visitDurationMinutes?: string;
  visitWindows?: string;
  visitWindowRows?: VisitWindowFieldErrors[];
};

export const MIN_VISIT_DURATION_MINUTES = 1;
export const MAX_VISIT_DURATION_MINUTES = 180;
export const DEFAULT_VISIT_DURATION_MINUTES = 30;

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

export const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  address: "",
  googlePlaceId: null,
  visitDurationMinutes: DEFAULT_VISIT_DURATION_MINUTES,
  visitWindows: [createEmptyVisitWindow()],
};

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

export const toTimeInput = (value: string) => value.slice(0, 5);

const getPatientVisitWindows = (patient: Patient) =>
  Array.isArray(patient.visitWindows) ? patient.visitWindows : [];

const formatWindowRange = (startTime: string, endTime: string) =>
  `${toTimeInput(startTime)}\u00A0-\u00A0${toTimeInput(endTime)}`;

export const toFormValues = (patient: Patient): PatientFormValues => ({
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
});

export const formatTimeWindow = (patient: Patient) =>
  (getPatientVisitWindows(patient).length > 0
    ? getPatientVisitWindows(patient).map(
        (window) => formatWindowRange(window.startTime, window.endTime),
      )
    : patient.visitTimeType === "flexible"
      ? ["Not set"]
      : [formatWindowRange(patient.preferredVisitStartTime, patient.preferredVisitEndTime)]).join(
    ", ",
  );

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
  const parsedWindows: { index: number; startMinutes: number; endMinutes: number }[] = [];

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

    parsedWindows.push({ index, startMinutes, endMinutes });
  });

  const ordered = [...parsedWindows].sort((left, right) => {
    const startDelta = left.startMinutes - right.startMinutes;
    if (startDelta !== 0) {
      return startDelta;
    }

    return left.endMinutes - right.endMinutes;
  });

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.startMinutes < previous.endMinutes) {
      visitWindowRows[current.index].startTime = "Overlaps with another visit window.";
      errors.visitWindows = "Visit windows must not overlap.";
    }
  }

  if (visitWindowRows.some((entry) => Object.keys(entry).length > 0)) {
    errors.visitWindowRows = visitWindowRows;
  }

  return errors;
};
