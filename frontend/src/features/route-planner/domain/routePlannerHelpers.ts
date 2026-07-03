import type { Patient, VisitInstance } from "../../../../../shared/contracts";
import { formatNameWords, formatPatientNameFromParts } from "../../patients/domain/patientName";
import type { SelectedPatientDestination } from "./routePlannerTypes";
import type { OptimizeRouteResponse } from "../types";

const DEFAULT_SERVICE_DURATION_MINUTES = 20;

export const toWindowTime = (value: string) => value.slice(0, 5);

export const toDisplayTime = (value: string) => {
  const [hourStr, minuteStr] = value.slice(0, 5).split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteStr} ${suffix}`;
};

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const hasCompleteWindow = (destination: SelectedPatientDestination) =>
  HH_MM_PATTERN.test(destination.windowStart) && HH_MM_PATTERN.test(destination.windowEnd);

export const hasAnyWindowBoundary = (destination: SelectedPatientDestination) =>
  destination.windowStart.trim().length > 0 || destination.windowEnd.trim().length > 0;

export const toSelectedPatientDestinations = (patient: Patient): SelectedPatientDestination[] => {
  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);
  const patientVisitWindows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (patientVisitWindows.length > 0) {
    return patientVisitWindows.map((window) => ({
      visitKey: `${patient.id}:${window.id}`,
      sourceWindowId: window.id,
      patientId: patient.id,
      patientName,
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
      windowStart: toWindowTime(window.startTime),
      windowEnd: toWindowTime(window.endTime),
      windowType: window.visitTimeType,
      serviceDurationMinutes: patient.visitDurationMinutes,
      requiresPlanningWindow: false,
      isIncluded: true,
      persistPlanningWindow: false,
    }));
  }

  if (patient.visitTimeType === "flexible") {
    return [
      {
        visitKey: `${patient.id}:planning-window`,
        sourceWindowId: null,
        patientId: patient.id,
        patientName,
        address: patient.address,
        googlePlaceId: patient.googlePlaceId,
        windowStart: "",
        windowEnd: "",
        windowType: "flexible",
        serviceDurationMinutes: patient.visitDurationMinutes,
        requiresPlanningWindow: true,
        isIncluded: true,
        persistPlanningWindow: false,
      },
    ];
  }

  return [
    {
      visitKey: `${patient.id}:legacy`,
      sourceWindowId: null,
      patientId: patient.id,
      patientName,
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
      windowStart: toWindowTime(patient.preferredVisitStartTime),
      windowEnd: toWindowTime(patient.preferredVisitEndTime),
      windowType: patient.visitTimeType,
      serviceDurationMinutes: patient.visitDurationMinutes,
      requiresPlanningWindow: false,
      isIncluded: true,
      persistPlanningWindow: false,
    },
  ];
};

export const toSelectedVisitInstanceDestinations = (
  patient: Patient,
  instances: VisitInstance[],
): SelectedPatientDestination[] => {
  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);

  return instances.map((instance) => ({
    visitKey: `${patient.id}:instance:${instance.id}`,
    visitId: instance.id,
    planningDate: instance.planningDate,
    originalPlanningDate: instance.planningDate,
    sourceWindowId: null,
    patientId: patient.id,
    patientName,
    address: instance.address,
    googlePlaceId: instance.googlePlaceId,
    windowStart: toWindowTime(instance.windowStart),
    originalWindowStart: toWindowTime(instance.windowStart),
    windowEnd: toWindowTime(instance.windowEnd),
    originalWindowEnd: toWindowTime(instance.windowEnd),
    windowType: instance.visitTimeType,
    serviceDurationMinutes: instance.serviceDurationMinutes,
    visitStatus: instance.status,
    requiresPlanningWindow: false,
    isIncluded: instance.status === "scheduled",
    persistPlanningWindow: false,
  }));
};

// Rebuild the "Your Route" selection from an optimized result's visits. Used
// when a result is restored from the session/runtime cache or a saved run — the
// result comes back but the selection was only auto-seeded from templates, so
// this makes "Your Route" reflect the clients actually in the shown route (and
// keeps re-optimize operating on them). Mirrors the manual-destination shape.
export const buildSelectedDestinationsFromResult = (
  result: OptimizeRouteResponse,
): SelectedPatientDestination[] => {
  const destinations: SelectedPatientDestination[] = [];
  const seen = new Set<string>();

  const push = (task: {
    visitId?: string;
    patientId: string;
    patientName?: string;
    address?: string;
    googlePlaceId?: string | null;
    windowStart?: string;
    windowEnd?: string;
    windowType?: "fixed" | "flexible";
    serviceDurationMinutes?: number;
  }) => {
    if (!task.patientId) {
      return;
    }
    const visitKey = task.visitId
      ? `${task.patientId}:result:${task.visitId}`
      : `${task.patientId}:result:${destinations.length}`;
    if (seen.has(visitKey)) {
      return;
    }
    seen.add(visitKey);
    destinations.push({
      visitKey,
      ...(task.visitId ? { visitId: task.visitId } : {}),
      sourceWindowId: null,
      patientId: task.patientId,
      patientName: task.patientName ?? "",
      address: task.address ?? "",
      googlePlaceId: task.googlePlaceId ?? null,
      windowStart: task.windowStart ? toWindowTime(task.windowStart) : "",
      windowEnd: task.windowEnd ? toWindowTime(task.windowEnd) : "",
      windowType: task.windowType ?? "flexible",
      serviceDurationMinutes: task.serviceDurationMinutes ?? DEFAULT_SERVICE_DURATION_MINUTES,
      requiresPlanningWindow: false,
      isIncluded: true,
      persistPlanningWindow: false,
    });
  };

  result.orderedStops.forEach((stop) => {
    if (stop.isEndingPoint) {
      return;
    }
    stop.tasks.forEach((task) => push(task));
  });
  result.unscheduledTasks.forEach((task) => push(task));

  return destinations;
};

export const formatPatientListLabel = (destinations: SelectedPatientDestination[]) => {
  const names = [
    ...new Set(
      destinations
        .map((destination) => formatNameWords(destination.patientName))
        .filter((name) => name.length > 0),
    ),
  ];

  if (names.length === 0) {
    return "selected clients";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

export const patientMatchesSearchQuery = (patient: Patient, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName).toLowerCase();
  const firstName = patient.firstName.toLowerCase();
  const lastName = patient.lastName.toLowerCase();
  const address = patient.address.toLowerCase();

  return (
    patientName.indexOf(normalizedQuery) !== -1 ||
    firstName.indexOf(normalizedQuery) !== -1 ||
    lastName.indexOf(normalizedQuery) !== -1 ||
    address.indexOf(normalizedQuery) !== -1
  );
};

// Alphabetical (A→Z) ordering for the client search list: by first name, then
// last name. Rows render as "First Last", so sorting on the leading name is
// what reads as sorted when scanning the list. Locale-aware and
// case-insensitive so accents and casing sort naturally.
export const comparePatientsByName = (a: Patient, b: Patient) => {
  const byFirstName = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
  if (byFirstName !== 0) {
    return byFirstName;
  }
  return a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
};
