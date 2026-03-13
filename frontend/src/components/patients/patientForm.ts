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
  visitWindows?: string;
  visitWindowRows?: VisitWindowFieldErrors[];
};

const createWindowId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `window-${Math.random().toString(36).slice(2, 10)}`;
};

export const createEmptyVisitWindow = (): PatientFormVisitWindow => ({
  id: createWindowId(),
  startTime: "09:00",
  endTime: "10:00",
  visitTimeType: "fixed",
});

export const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  address: "",
  googlePlaceId: null,
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

export const toFormValues = (patient: Patient): PatientFormValues => ({
  firstName: patient.firstName,
  lastName: patient.lastName,
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
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
        (window) => `${toTimeInput(window.startTime)} - ${toTimeInput(window.endTime)}`,
      )
    : patient.visitTimeType === "flexible"
      ? ["Not set"]
      : [`${toTimeInput(patient.preferredVisitStartTime)} - ${toTimeInput(patient.preferredVisitEndTime)}`]).join(
    ", ",
  );

export const getPatientDisplayName = (patient: Patient) =>
  formatPatientNameFromParts(patient.firstName, patient.lastName);

export const toCreateRequest = (values: PatientFormValues): CreatePatientRequest => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  address: values.address.trim(),
  googlePlaceId: values.googlePlaceId,
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
