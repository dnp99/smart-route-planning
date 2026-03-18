import { HttpError } from "../../../../lib/http";
import type { OptimizeRouteRequestV2, VisitV2, WindowTypeV2 } from "./types";

const MAX_VISITS = 40;
const MAX_UNIQUE_LOCATIONS = 25;
const MAX_ADDRESS_LENGTH = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_WITH_OFFSET_PATTERN = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

const normalizeAddressKey = (value: string) => value.trim().toLowerCase();

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

const parseOptionalStringOrNull = (value: unknown, fieldName: string): string | null | undefined => {
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

const parseAddress = (value: unknown, fieldName: string) => {
  const address = trimRequiredString(value, fieldName);
  if (address.length > MAX_ADDRESS_LENGTH) {
    throw new HttpError(400, `${fieldName} must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }

  return address;
};

const parsePlanningDate = (value: unknown) => {
  const planningDate = trimRequiredString(value, "planningDate");
  if (!DATE_PATTERN.test(planningDate)) {
    throw new HttpError(400, "planningDate must use YYYY-MM-DD format.");
  }

  const [yearString, monthString, dayString] = planningDate.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "planningDate must be a valid calendar date.");
  }

  return planningDate;
};

const parseTimezone = (value: unknown) => {
  const timezone = trimRequiredString(value, "timezone");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return timezone;
};

const formatDateInTimeZone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return `${year}-${month}-${day}`;
};

const parseDepartureTime = (
  value: unknown,
  planningDate: string,
  timezone: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const departureTime = trimRequiredString(value, "start.departureTime");
  if (!ISO_WITH_OFFSET_PATTERN.test(departureTime)) {
    throw new HttpError(400, "start.departureTime must be an ISO-8601 timestamp with timezone.");
  }

  const date = new Date(departureTime);
  const timestamp = date.getTime();
  if (timestamp !== timestamp) {
    throw new HttpError(400, "start.departureTime must be a valid ISO-8601 timestamp.");
  }

  const localDate = formatDateInTimeZone(date, timezone);
  if (localDate !== planningDate) {
    throw new HttpError(400, "start.departureTime must match planningDate in timezone.");
  }

  return departureTime;
};

const parseWindowType = (value: unknown, fieldName: string): WindowTypeV2 => {
  if (value !== "fixed" && value !== "flexible") {
    throw new HttpError(400, `${fieldName} must be one of: fixed, flexible.`);
  }

  return value;
};

const parseTime = (value: unknown, fieldName: string) => {
  const parsed = trimRequiredString(value, fieldName);
  if (!HH_MM_PATTERN.test(parsed)) {
    throw new HttpError(400, `${fieldName} must use HH:MM 24-hour format.`);
  }

  return parsed;
};

const parseOptionalTime = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string when provided.`);
  }

  const parsed = value.trim();
  if (!parsed) {
    return undefined;
  }

  if (!HH_MM_PATTERN.test(parsed)) {
    throw new HttpError(400, `${fieldName} must use HH:MM 24-hour format.`);
  }

  return parsed;
};

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new HttpError(400, `${fieldName} must be a positive integer.`);
  }

  return value;
};

const parsePriority = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || value !== value || value === Infinity || value === -Infinity) {
    throw new HttpError(400, `${fieldName} must be a finite number when provided.`);
  }

  return value;
};

const parseVisit = (value: unknown, index: number): VisitV2 => {
  if (typeof value !== "object" || value === null) {
    throw new HttpError(400, `visits[${index}] must be a JSON object.`);
  }

  const candidate = value as Record<string, unknown>;
  const visitId = trimRequiredString(candidate.visitId, `visits[${index}].visitId`);
  const patientId = trimRequiredString(candidate.patientId, `visits[${index}].patientId`);
  const patientName = trimRequiredString(candidate.patientName, `visits[${index}].patientName`);
  const address = parseAddress(candidate.address, `visits[${index}].address`);
  const googlePlaceId = parseOptionalStringOrNull(candidate.googlePlaceId, `visits[${index}].googlePlaceId`);
  const windowType = parseWindowType(candidate.windowType, `visits[${index}].windowType`);
  const serviceDurationMinutes = parsePositiveInteger(
    candidate.serviceDurationMinutes,
    `visits[${index}].serviceDurationMinutes`,
  );
  const priority = parsePriority(candidate.priority, `visits[${index}].priority`);

  const windowStartFieldName = `visits[${index}].windowStart`;
  const windowEndFieldName = `visits[${index}].windowEnd`;
  let windowStart = "";
  let windowEnd = "";

  if (windowType === "fixed") {
    windowStart = parseTime(candidate.windowStart, windowStartFieldName);
    windowEnd = parseTime(candidate.windowEnd, windowEndFieldName);
  } else {
    const parsedWindowStart = parseOptionalTime(candidate.windowStart, windowStartFieldName);
    const parsedWindowEnd = parseOptionalTime(candidate.windowEnd, windowEndFieldName);

    if (
      (parsedWindowStart !== undefined && parsedWindowEnd === undefined) ||
      (parsedWindowStart === undefined && parsedWindowEnd !== undefined)
    ) {
      throw new HttpError(
        400,
        `${patientName} flexible visit window must include both start and end time when one value is provided.`,
      );
    }

    windowStart = parsedWindowStart ?? "";
    windowEnd = parsedWindowEnd ?? "";
  }

  if (windowType === "fixed" && (!windowStart || !windowEnd)) {
    throw new HttpError(400, `${patientName} fixed visits must include start and end time.`);
  }

  if (!windowStart && !windowEnd) {
    return {
      visitId,
      patientId,
      patientName,
      address,
      ...(googlePlaceId !== undefined ? { googlePlaceId } : {}),
      windowStart: "",
      windowEnd: "",
      windowType,
      serviceDurationMinutes,
      ...(priority !== undefined ? { priority } : {}),
    };
  }

  const windowStartMinutes = timeToMinutes(windowStart);
  const windowEndMinutes = timeToMinutes(windowEnd);
  if (windowEndMinutes <= windowStartMinutes) {
    throw new HttpError(
      400,
      `visits[${index}].windowEnd must be later than visits[${index}].windowStart (cross-midnight windows are not supported).`,
    );
  }

  if (windowType === "fixed" && windowEndMinutes - windowStartMinutes < serviceDurationMinutes) {
    const minuteLabel = serviceDurationMinutes === 1 ? "minute" : "minutes";
    throw new HttpError(
      400,
      `${patientName} fixed window must be at least ${serviceDurationMinutes} ${minuteLabel} long as per patient's profile.`,
    );
  }

  return {
    visitId,
    patientId,
    patientName,
    address,
    ...(googlePlaceId !== undefined ? { googlePlaceId } : {}),
    windowStart,
    windowEnd,
    windowType,
    serviceDurationMinutes,
    ...(priority !== undefined ? { priority } : {}),
  };
};

const buildLocationKey = ({ address, googlePlaceId }: { address: string; googlePlaceId?: string | null }) => {
  if (googlePlaceId && googlePlaceId.trim().length > 0) {
    return `place:${googlePlaceId.trim()}`;
  }

  return `address:${normalizeAddressKey(address)}`;
};

export type ValidatedOptimizeRouteV2Request = OptimizeRouteRequestV2;

export const parseAndValidateBody = (body: unknown): ValidatedOptimizeRouteV2Request => {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "Invalid request body.");
  }

  const payload = body as Record<string, unknown>;
  const planningDate = parsePlanningDate(payload.planningDate);
  const timezone = parseTimezone(payload.timezone);

  if (typeof payload.start !== "object" || payload.start === null) {
    throw new HttpError(400, "start must be a JSON object.");
  }

  if (typeof payload.end !== "object" || payload.end === null) {
    throw new HttpError(400, "end must be a JSON object.");
  }

  const startCandidate = payload.start as Record<string, unknown>;
  const endCandidate = payload.end as Record<string, unknown>;

  const startAddress = parseAddress(startCandidate.address, "start.address");
  const startGooglePlaceId = parseOptionalStringOrNull(startCandidate.googlePlaceId, "start.googlePlaceId");
  const departureTime = parseDepartureTime(startCandidate.departureTime, planningDate, timezone);

  const endAddress = parseAddress(endCandidate.address, "end.address");
  const endGooglePlaceId = parseOptionalStringOrNull(endCandidate.googlePlaceId, "end.googlePlaceId");

  if (!Array.isArray(payload.visits)) {
    throw new HttpError(400, "visits must be an array.");
  }

  if (payload.visits.length > MAX_VISITS) {
    throw new HttpError(400, `Please provide at most ${MAX_VISITS} visits.`);
  }

  const visits = payload.visits.map((visit, index) => parseVisit(visit, index));

  const visitIds = new Set<string>();
  visits.forEach((visit) => {
    if (visitIds.has(visit.visitId)) {
      throw new HttpError(400, "visitId values must be unique.");
    }

    visitIds.add(visit.visitId);
  });

  const uniqueLocationKeys = new Set<string>();
  uniqueLocationKeys.add(buildLocationKey({ address: startAddress, googlePlaceId: startGooglePlaceId }));
  uniqueLocationKeys.add(buildLocationKey({ address: endAddress, googlePlaceId: endGooglePlaceId }));
  visits.forEach((visit) => {
    uniqueLocationKeys.add(buildLocationKey(visit));
  });

  if (uniqueLocationKeys.size > MAX_UNIQUE_LOCATIONS) {
    throw new HttpError(400, `Please provide at most ${MAX_UNIQUE_LOCATIONS} unique locations.`);
  }

  return {
    planningDate,
    timezone,
    start: {
      address: startAddress,
      ...(startGooglePlaceId !== undefined ? { googlePlaceId: startGooglePlaceId } : {}),
      ...(departureTime !== undefined ? { departureTime } : {}),
    },
    end: {
      address: endAddress,
      ...(endGooglePlaceId !== undefined ? { googlePlaceId: endGooglePlaceId } : {}),
    },
    visits,
  };
};
