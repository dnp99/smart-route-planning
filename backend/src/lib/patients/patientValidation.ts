import { HttpError } from "../http";
import type { CreatePatientRequest, UpdatePatientRequest, VisitTimeType } from "../../../../shared/contracts";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

const parseVisitTimeType = (value: unknown): VisitTimeType => {
  if (value !== "fixed" && value !== "flexible") {
    throw new HttpError(400, "visitTimeType must be one of: fixed, flexible.");
  }

  return value;
};

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

export const validateTimeWindow = (startTime: string, endTime: string) => {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new HttpError(
      400,
      "preferredVisitEndTime must be later than preferredVisitStartTime (cross-midnight windows are not supported).",
    );
  }
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
    preferredVisitStartTime: requireTime(payload.preferredVisitStartTime, "preferredVisitStartTime"),
    preferredVisitEndTime: requireTime(payload.preferredVisitEndTime, "preferredVisitEndTime"),
    visitTimeType: parseVisitTimeType(payload.visitTimeType),
  };

  validateTimeWindow(parsed.preferredVisitStartTime, parsed.preferredVisitEndTime);
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

  if (payload.preferredVisitStartTime !== undefined) {
    parsed.preferredVisitStartTime = requireTime(
      payload.preferredVisitStartTime,
      "preferredVisitStartTime",
    );
  }

  if (payload.preferredVisitEndTime !== undefined) {
    parsed.preferredVisitEndTime = requireTime(payload.preferredVisitEndTime, "preferredVisitEndTime");
  }

  if (payload.visitTimeType !== undefined) {
    parsed.visitTimeType = parseVisitTimeType(payload.visitTimeType);
  }

  return parsed;
};
