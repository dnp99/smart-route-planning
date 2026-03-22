import {
  parseListPatientsResponse,
  parseOptimizeRouteV2Response,
  type OptimizeRouteV2WindowType,
  type PatientVisitWindowInput,
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

const buildVisitId = (patientId: string, index: number) => `visit-${index + 1}-${patientId}`;

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

export type PersistPlanningWindowInput = {
  patientId: string;
  sourceWindowId?: string | null;
  startTime: string;
  endTime: string;
  visitTimeType: OptimizeRouteV2WindowType;
};

type OptimizeRouteRequestInput = {
  startAddress: string;
  startGooglePlaceId?: string | null;
  endAddress: string;
  endGooglePlaceId?: string | null;
  destinations: OptimizeRouteDestinationInput[];
  planningDate?: string;
  timezone?: string;
  preserveOrder?: boolean;
};

export const persistPlanningWindows = async (
  windows: PersistPlanningWindowInput[],
): Promise<void> => {
  if (windows.length === 0) {
    return;
  }

  const windowsByPatientId = new Map<
    string,
    Array<PatientVisitWindowInput & { sourceWindowId: string | null }>
  >();
  windows.forEach((window) => {
    const nextWindow = {
      sourceWindowId:
        typeof window.sourceWindowId === "string" && window.sourceWindowId.trim().length > 0
          ? window.sourceWindowId.trim()
          : null,
      startTime: normalizeWindowTime(window.startTime),
      endTime: normalizeWindowTime(window.endTime),
      visitTimeType: window.visitTimeType,
    } as const;

    const current = windowsByPatientId.get(window.patientId) ?? [];
    current.push(nextWindow);
    windowsByPatientId.set(window.patientId, current);
  });

  const patientsPayload = await requestAuthedJson(
    "/api/patients",
    {
      method: "GET",
    },
    "Unable to save planning windows.",
  );
  const patients = parseListPatientsResponse(patientsPayload).patients;
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  const compareVisitWindows = (left: PatientVisitWindowInput, right: PatientVisitWindowInput) => {
    const startDelta = left.startTime.localeCompare(right.startTime);
    if (startDelta !== 0) {
      return startDelta;
    }

    const endDelta = left.endTime.localeCompare(right.endTime);
    if (endDelta !== 0) {
      return endDelta;
    }

    return left.visitTimeType.localeCompare(right.visitTimeType);
  };

  await Promise.all(
    [...windowsByPatientId.entries()].map(async ([patientId, overrides]) => {
      const patient = patientsById.get(patientId);
      if (!patient) {
        throw new Error("Unable to save planning windows.");
      }

      const nextVisitWindows: PatientVisitWindowInput[] = patient.visitWindows.map((window) => ({
        startTime: normalizeWindowTime(window.startTime),
        endTime: normalizeWindowTime(window.endTime),
        visitTimeType: window.visitTimeType,
      }));

      const indexByWindowId = new Map(
        patient.visitWindows.map((window, index) => [window.id, index]),
      );

      overrides.forEach((override) => {
        const nextWindow: PatientVisitWindowInput = {
          startTime: override.startTime,
          endTime: override.endTime,
          visitTimeType: override.visitTimeType,
        };

        if (override.sourceWindowId && indexByWindowId.has(override.sourceWindowId)) {
          const existingIndex = indexByWindowId.get(override.sourceWindowId);
          if (existingIndex !== undefined) {
            nextVisitWindows[existingIndex] = nextWindow;
          }
          return;
        }

        nextVisitWindows.push(nextWindow);
      });

      nextVisitWindows.sort(compareVisitWindows);

      await requestAuthedJson(
        `/api/patients/${encodeURIComponent(patientId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ visitWindows: nextVisitWindows }),
        },
        "Unable to save planning windows.",
      );
    }),
  );
};

export const requestOptimizedRoute = async ({
  startAddress,
  startGooglePlaceId,
  endAddress,
  endGooglePlaceId,
  destinations,
  planningDate,
  timezone,
  preserveOrder,
}: OptimizeRouteRequestInput): Promise<OptimizeRouteResponse> => {
  const resolvedTimezone = resolveTimezone(timezone);
  const now = new Date();
  const resolvedPlanningDate = planningDate ?? formatDateInTimeZone(now, resolvedTimezone);

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
      ...(destination.priority !== undefined ? { priority: destination.priority } : {}),
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
          ...(startGooglePlaceId !== undefined ? { googlePlaceId: startGooglePlaceId } : {}),
        },
        end: {
          address: endAddress,
          ...(endGooglePlaceId !== undefined ? { googlePlaceId: endGooglePlaceId } : {}),
        },
        visits,
        ...(preserveOrder === true ? { preserveOrder: true } : {}),
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
