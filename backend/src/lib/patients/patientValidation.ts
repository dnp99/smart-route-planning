import { HttpError } from "../http";
import type {
  CreatePatientRequest,
  PatientVisitWindowInput,
  UpdatePatientRequest,
  VisitTimeType,
} from "../../../../shared/contracts";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_VISIT_DURATION_MINUTES = 30;
const MIN_VISIT_DURATION_MINUTES = 1;
const MAX_VISIT_DURATION_MINUTES = 180;

const requireNonEmptyString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return value.trim();
};

const parseOptionalString = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const requireTime = (value: unknown, fieldName: string) => {
  const parsed = requireNonEmptyString(value, fieldName);
  if (!HH_MM_PATTERN.test(parsed)) {
    throw new HttpError(400, `${fieldName} must use HH:MM 24-hour format.`);
  }

  return parsed;
};

const parseVisitTimeType = (value: unknown, fieldName = "visitTimeType"): VisitTimeType => {
  if (value !== "fixed" && value !== "flexible") {
    throw new HttpError(400, `${fieldName} must be one of: fixed, flexible.`);
  }

  return value;
};

const parseVisitDurationMinutes = (value: unknown, fieldName = "visitDurationMinutes"): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(
      400,
      `${fieldName} must be an integer between ${MIN_VISIT_DURATION_MINUTES} and ${MAX_VISIT_DURATION_MINUTES}.`,
    );
  }

  if (value < MIN_VISIT_DURATION_MINUTES || value > MAX_VISIT_DURATION_MINUTES) {
    throw new HttpError(
      400,
      `${fieldName} must be between ${MIN_VISIT_DURATION_MINUTES} and ${MAX_VISIT_DURATION_MINUTES}.`,
    );
  }

  return value;
};

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

export const validateTimeWindow = (
  startTime: string,
  endTime: string,
  startFieldName = "preferredVisitStartTime",
  endFieldName = "preferredVisitEndTime",
) => {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new HttpError(
      400,
      `${endFieldName} must be later than ${startFieldName} (cross-midnight windows are not supported).`,
    );
  }
};

const parseVisitWindow = (value: unknown, index: number): PatientVisitWindowInput => {
  if (!isObject(value)) {
    throw new HttpError(400, `visitWindows[${index}] must be a JSON object.`);
  }

  const startTime = requireTime(value.startTime, `visitWindows[${index}].startTime`);
  const endTime = requireTime(value.endTime, `visitWindows[${index}].endTime`);
  validateTimeWindow(
    startTime,
    endTime,
    `visitWindows[${index}].startTime`,
    `visitWindows[${index}].endTime`,
  );

  return {
    startTime,
    endTime,
    visitTimeType: parseVisitTimeType(value.visitTimeType, `visitWindows[${index}].visitTimeType`),
  };
};

const parseVisitWindows = (value: unknown, fieldName: string): PatientVisitWindowInput[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an array.`);
  }

  return value.map((entry, index) => parseVisitWindow(entry, index));
};

export const validateCreatePatientPayload = (payload: unknown): CreatePatientRequest => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const parsed: CreatePatientRequest = {
    firstName: requireNonEmptyString(payload.firstName, "firstName"),
    lastName: requireNonEmptyString(payload.lastName, "lastName"),
    address: requireNonEmptyString(payload.address, "address"),
    googlePlaceId: parseOptionalString(payload.googlePlaceId, "googlePlaceId"),
    visitDurationMinutes:
      payload.visitDurationMinutes === undefined
        ? DEFAULT_VISIT_DURATION_MINUTES
        : parseVisitDurationMinutes(payload.visitDurationMinutes),
    visitWindows: parseVisitWindows(payload.visitWindows, "visitWindows"),
  };

  return parsed;
};

export const validateUpdatePatientPayload = (payload: unknown): UpdatePatientRequest => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const parsed: UpdatePatientRequest = {};

  if (payload.firstName !== undefined) {
    parsed.firstName = requireNonEmptyString(payload.firstName, "firstName");
  }

  if (payload.lastName !== undefined) {
    parsed.lastName = requireNonEmptyString(payload.lastName, "lastName");
  }

  if (payload.address !== undefined) {
    parsed.address = requireNonEmptyString(payload.address, "address");
  }

  if (payload.googlePlaceId !== undefined) {
    parsed.googlePlaceId = parseOptionalString(payload.googlePlaceId, "googlePlaceId");
  }

  if (payload.visitDurationMinutes !== undefined) {
    parsed.visitDurationMinutes = parseVisitDurationMinutes(payload.visitDurationMinutes);
  }

  if (payload.visitWindows !== undefined) {
    parsed.visitWindows = parseVisitWindows(payload.visitWindows, "visitWindows");
  }

  return parsed;
};
