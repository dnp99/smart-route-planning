import { HttpError } from "../http";
import type {
  CreateRecurringVisitTemplateRequest,
  RecurringVisitTemplateWindowInput,
  UpdateRecurringVisitTemplateRequest,
  VisitInstanceStatus,
  VisitTimeType,
} from "../../../../shared/contracts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const trimRequiredString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return trimmed;
};

const parseOptionalString = (value: unknown, fieldName: string): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDate = (value: unknown, fieldName: string) => {
  const parsed = trimRequiredString(value, fieldName);
  if (!DATE_PATTERN.test(parsed)) {
    throw new HttpError(400, `${fieldName} must use YYYY-MM-DD format.`);
  }

  const [yearString, monthString, dayString] = parsed.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${fieldName} must be a valid calendar date.`);
  }

  return parsed;
};

const parseTime = (value: unknown, fieldName: string) => {
  const parsed = trimRequiredString(value, fieldName);
  if (!HH_MM_PATTERN.test(parsed)) {
    throw new HttpError(400, `${fieldName} must use HH:MM 24-hour format.`);
  }

  return parsed;
};

const parseVisitTimeType = (value: unknown, fieldName: string): VisitTimeType => {
  if (value !== "fixed" && value !== "flexible") {
    throw new HttpError(400, `${fieldName} must be one of: fixed, flexible.`);
  }

  return value;
};

const parseVisitInstanceStatus = (value: unknown, fieldName: string): VisitInstanceStatus => {
  if (value !== "scheduled" && value !== "cancelled") {
    throw new HttpError(400, `${fieldName} must be one of: scheduled, cancelled.`);
  }

  return value;
};

const parseDurationMinutes = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(
      400,
      `${fieldName} must be an integer between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}.`,
    );
  }

  if (value < MIN_DURATION_MINUTES || value > MAX_DURATION_MINUTES) {
    throw new HttpError(
      400,
      `${fieldName} must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}.`,
    );
  }

  return value;
};

const parseTimezone = (value: unknown, fieldName: string) => {
  const timezone = trimRequiredString(value, fieldName);

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new HttpError(400, `${fieldName} must be a valid IANA timezone.`);
  }

  return timezone;
};

const parseDayOfWeek = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) {
    throw new HttpError(400, `${fieldName} must be an integer from 0 (Sunday) to 6 (Saturday).`);
  }

  return value;
};

const toMinutes = (time: string) => {
  const [hourString, minuteString] = time.split(":");
  return Number(hourString) * 60 + Number(minuteString);
};

const parseRecurringTemplateWindow = (
  value: unknown,
  index: number,
): RecurringVisitTemplateWindowInput => {
  if (!isObject(value)) {
    throw new HttpError(400, `windows[${index}] must be a JSON object.`);
  }

  const startTime = parseTime(value.startTime, `windows[${index}].startTime`);
  const endTime = parseTime(value.endTime, `windows[${index}].endTime`);

  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new HttpError(
      400,
      `windows[${index}].endTime must be later than windows[${index}].startTime.`,
    );
  }

  return {
    dayOfWeek: parseDayOfWeek(value.dayOfWeek, `windows[${index}].dayOfWeek`),
    startTime,
    endTime,
    visitTimeType: parseVisitTimeType(value.visitTimeType, `windows[${index}].visitTimeType`),
  };
};

const parseRecurringTemplateWindows = (value: unknown, fieldName: string) => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an array.`);
  }

  const windows = value.map((entry, index) => parseRecurringTemplateWindow(entry, index));
  if (windows.length === 0) {
    throw new HttpError(400, `${fieldName} must include at least one visit window.`);
  }

  return windows;
};

export type ExpandVisitInstancesPayload = {
  startDate: string;
  endDate: string;
  templateIds?: string[];
};

export type UpdateVisitInstancePayload = {
  status?: VisitInstanceStatus;
  planningDate?: string;
  address?: string;
  googlePlaceId?: string | null;
  windowStart?: string;
  windowEnd?: string;
  visitTimeType?: VisitTimeType;
  serviceDurationMinutes?: number;
};

export const validateCreateRecurringVisitTemplatePayload = (
  payload: unknown,
): CreateRecurringVisitTemplateRequest => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const startDate = parseDate(payload.startDate, "startDate");
  const endDate =
    payload.endDate === undefined || payload.endDate === null
      ? null
      : parseDate(payload.endDate, "endDate");
  if (endDate !== null && endDate < startDate) {
    throw new HttpError(400, "endDate must be on or after startDate.");
  }

  return {
    patientId: trimRequiredString(payload.patientId, "patientId"),
    name: parseOptionalString(payload.name, "name") ?? null,
    timezone: parseTimezone(payload.timezone, "timezone"),
    recurrenceRule: trimRequiredString(payload.recurrenceRule, "recurrenceRule"),
    startDate,
    endDate,
    serviceDurationMinutes:
      payload.serviceDurationMinutes === undefined
        ? 30
        : parseDurationMinutes(payload.serviceDurationMinutes, "serviceDurationMinutes"),
    windows: parseRecurringTemplateWindows(payload.windows, "windows"),
  };
};

export const validateUpdateRecurringVisitTemplatePayload = (
  payload: unknown,
): UpdateRecurringVisitTemplateRequest => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const parsed: UpdateRecurringVisitTemplateRequest = {};

  if (payload.patientId !== undefined) {
    parsed.patientId = trimRequiredString(payload.patientId, "patientId");
  }

  if (payload.name !== undefined) {
    parsed.name = parseOptionalString(payload.name, "name") ?? null;
  }

  if (payload.timezone !== undefined) {
    parsed.timezone = parseTimezone(payload.timezone, "timezone");
  }

  if (payload.recurrenceRule !== undefined) {
    parsed.recurrenceRule = trimRequiredString(payload.recurrenceRule, "recurrenceRule");
  }

  if (payload.startDate !== undefined) {
    parsed.startDate = parseDate(payload.startDate, "startDate");
  }

  if (payload.endDate !== undefined) {
    parsed.endDate =
      payload.endDate === null ? null : parseDate(payload.endDate, "endDate");
  }

  if (payload.serviceDurationMinutes !== undefined) {
    parsed.serviceDurationMinutes = parseDurationMinutes(
      payload.serviceDurationMinutes,
      "serviceDurationMinutes",
    );
  }

  if (payload.windows !== undefined) {
    parsed.windows = parseRecurringTemplateWindows(payload.windows, "windows");
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== "boolean") {
      throw new HttpError(400, "isActive must be a boolean when provided.");
    }
    parsed.isActive = payload.isActive;
  }

  const nextStartDate = parsed.startDate;
  const nextEndDate = parsed.endDate;
  if (nextStartDate !== undefined && nextEndDate !== undefined && nextEndDate !== null) {
    if (nextEndDate < nextStartDate) {
      throw new HttpError(400, "endDate must be on or after startDate.");
    }
  }

  return parsed;
};

export const validateExpandVisitInstancesPayload = (payload: unknown): ExpandVisitInstancesPayload => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const planningDate =
    payload.planningDate === undefined || payload.planningDate === null
      ? undefined
      : parseDate(payload.planningDate, "planningDate");

  const startDate =
    payload.startDate === undefined || payload.startDate === null
      ? planningDate
      : parseDate(payload.startDate, "startDate");

  const endDate =
    payload.endDate === undefined || payload.endDate === null
      ? startDate
      : parseDate(payload.endDate, "endDate");

  if (!startDate || !endDate) {
    throw new HttpError(400, "Either planningDate or startDate must be provided.");
  }

  if (endDate < startDate) {
    throw new HttpError(400, "endDate must be on or after startDate.");
  }

  let templateIds: string[] | undefined;
  if (payload.templateIds !== undefined) {
    if (!Array.isArray(payload.templateIds)) {
      throw new HttpError(400, "templateIds must be an array when provided.");
    }

    const normalizedTemplateIds = payload.templateIds
      .map((value, index) => trimRequiredString(value, `templateIds[${index}]`))
      .filter(Boolean);
    if (normalizedTemplateIds.length > 0) {
      templateIds = normalizedTemplateIds;
    }
  }

  return {
    startDate,
    endDate,
    ...(templateIds ? { templateIds } : {}),
  };
};

export const validateVisitInstancesPlanningDate = (value: string | null) => {
  if (!value) {
    throw new HttpError(400, "planningDate query parameter is required.");
  }

  return parseDate(value, "planningDate");
};

export const validateUpdateVisitInstancePayload = (payload: unknown): UpdateVisitInstancePayload => {
  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const parsed: UpdateVisitInstancePayload = {};

  if (payload.status !== undefined) {
    parsed.status = parseVisitInstanceStatus(payload.status, "status");
  }

  if (payload.planningDate !== undefined) {
    parsed.planningDate = parseDate(payload.planningDate, "planningDate");
  }

  if (payload.address !== undefined) {
    parsed.address = trimRequiredString(payload.address, "address");
  }

  if (payload.googlePlaceId !== undefined) {
    parsed.googlePlaceId = parseOptionalString(payload.googlePlaceId, "googlePlaceId") ?? null;
  }

  if (payload.windowStart !== undefined) {
    parsed.windowStart = parseTime(payload.windowStart, "windowStart");
  }

  if (payload.windowEnd !== undefined) {
    parsed.windowEnd = parseTime(payload.windowEnd, "windowEnd");
  }

  if (payload.visitTimeType !== undefined) {
    parsed.visitTimeType = parseVisitTimeType(payload.visitTimeType, "visitTimeType");
  }

  if (payload.serviceDurationMinutes !== undefined) {
    parsed.serviceDurationMinutes = parseDurationMinutes(
      payload.serviceDurationMinutes,
      "serviceDurationMinutes",
    );
  }

  if (Object.keys(parsed).length === 0) {
    throw new HttpError(400, "At least one updatable field is required.");
  }

  if (
    parsed.windowStart !== undefined &&
    parsed.windowEnd !== undefined &&
    toMinutes(parsed.windowEnd) <= toMinutes(parsed.windowStart)
  ) {
    throw new HttpError(400, "windowEnd must be later than windowStart.");
  }

  return parsed;
};
