import {
  parseOptimizeRouteV2Response,
  type OptimizeRouteV2WindowType,
} from "../../../../shared/contracts";
import { requestAuthedJson } from "../auth/authFetch";
import type { OptimizeRouteResponse } from "../types";

const DEFAULT_SERVICE_DURATION_MINUTES = 20;

const toWindowMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (hours !== hours || minutes !== minutes) {
    return 0;
  }

  return hours * 60 + minutes;
};

const normalizeWindowTime = (value: string) => value.trim().slice(0, 5);

const resolveServiceDurationMinutes = ({
  windowStart,
  windowEnd,
  serviceDurationMinutes,
}: {
  windowStart: string;
  windowEnd: string;
  serviceDurationMinutes?: number;
}) => {
  if (
    typeof serviceDurationMinutes === "number" &&
    Number.isInteger(serviceDurationMinutes) &&
    serviceDurationMinutes > 0
  ) {
    return serviceDurationMinutes;
  }

  const windowMinutes = toWindowMinutes(windowEnd) - toWindowMinutes(windowStart);
  if (windowMinutes <= 0) {
    return DEFAULT_SERVICE_DURATION_MINUTES;
  }

  return Math.min(DEFAULT_SERVICE_DURATION_MINUTES, windowMinutes);
};

const resolveTimezone = (timezone?: string) => {
  if (typeof timezone === "string" && timezone.trim().length > 0) {
    return timezone.trim();
  }

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof detectedTimezone === "string" && detectedTimezone.trim().length > 0) {
    return detectedTimezone;
  }

  return "UTC";
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
    throw new Error("Unable to resolve planning date in timezone.");
  }

  return `${year}-${month}-${day}`;
};

const buildVisitId = (patientId: string, index: number) =>
  `visit-${index + 1}-${patientId}`;

export type OptimizeRouteDestinationInput = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: OptimizeRouteV2WindowType;
  serviceDurationMinutes?: number;
  priority?: number;
};

type OptimizeRouteRequestInput = {
  startAddress: string;
  startGooglePlaceId?: string | null;
  endAddress: string;
  endGooglePlaceId?: string | null;
  destinations: OptimizeRouteDestinationInput[];
  planningDate?: string;
  timezone?: string;
  departureTime?: string;
};

export const requestOptimizedRoute = async ({
  startAddress,
  startGooglePlaceId,
  endAddress,
  endGooglePlaceId,
  destinations,
  planningDate,
  timezone,
  departureTime,
}: OptimizeRouteRequestInput): Promise<OptimizeRouteResponse> => {
  const resolvedTimezone = resolveTimezone(timezone);
  const resolvedDepartureTime = departureTime ?? new Date().toISOString();
  const resolvedDepartureDate = new Date(resolvedDepartureTime);

  if (resolvedDepartureDate.getTime() !== resolvedDepartureDate.getTime()) {
    throw new Error("Invalid departure time.");
  }

  const resolvedPlanningDate =
    planningDate ?? formatDateInTimeZone(resolvedDepartureDate, resolvedTimezone);

  const visits = destinations.map((destination, index) => {
    const windowStart = normalizeWindowTime(destination.windowStart);
    const windowEnd = normalizeWindowTime(destination.windowEnd);

    return {
      visitId: buildVisitId(destination.patientId, index),
      patientId: destination.patientId,
      patientName: destination.patientName,
      address: destination.address,
      ...(destination.googlePlaceId !== undefined
        ? { googlePlaceId: destination.googlePlaceId }
        : {}),
      windowStart,
      windowEnd,
      windowType: destination.windowType,
      serviceDurationMinutes: resolveServiceDurationMinutes({
        windowStart,
        windowEnd,
        serviceDurationMinutes: destination.serviceDurationMinutes,
      }),
      ...(destination.priority !== undefined
        ? { priority: destination.priority }
        : {}),
    };
  });

  const visitById = new Map(visits.map((visit) => [visit.visitId, visit]));

  const payload = await requestAuthedJson(
    "/api/optimize-route/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planningDate: resolvedPlanningDate,
        timezone: resolvedTimezone,
        start: {
          address: startAddress,
          ...(startGooglePlaceId !== undefined
            ? { googlePlaceId: startGooglePlaceId }
            : {}),
          departureTime: resolvedDepartureTime,
        },
        end: {
          address: endAddress,
          ...(endGooglePlaceId !== undefined
            ? { googlePlaceId: endGooglePlaceId }
            : {}),
        },
        visits,
      }),
    },
    "Unable to optimize route.",
  );

  const parsedResponse = parseOptimizeRouteV2Response(payload);
  if (!parsedResponse) {
    throw new Error("Unexpected API response format.");
  }

  const unscheduledTasks = parsedResponse.unscheduledTasks.map((task) => {
    const sourceVisit = visitById.get(task.visitId);
    if (!sourceVisit) {
      return task;
    }

    return {
      ...task,
      patientName: sourceVisit.patientName,
      address: sourceVisit.address,
      windowStart: sourceVisit.windowStart,
      windowEnd: sourceVisit.windowEnd,
      windowType: sourceVisit.windowType,
    };
  });

  return {
    ...parsedResponse,
    unscheduledTasks,
  };
};
