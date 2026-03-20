import type { Patient } from "../../../../shared/contracts";
import {
  formatNameWords,
  formatPatientNameFromParts,
} from "../patients/patientName";
import type { SelectedPatientDestination } from "./routePlannerTypes";

export const toWindowTime = (value: string) => value.slice(0, 5);

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const hasCompleteWindow = (destination: SelectedPatientDestination) =>
  HH_MM_PATTERN.test(destination.windowStart) &&
  HH_MM_PATTERN.test(destination.windowEnd);

export const hasAnyWindowBoundary = (destination: SelectedPatientDestination) =>
  destination.windowStart.trim().length > 0 ||
  destination.windowEnd.trim().length > 0;

export const toSelectedPatientDestinations = (
  patient: Patient,
): SelectedPatientDestination[] => {
  const patientName = formatPatientNameFromParts(
    patient.firstName,
    patient.lastName,
  );
  const patientVisitWindows = Array.isArray(patient.visitWindows)
    ? patient.visitWindows
    : [];
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

export const formatPatientListLabel = (
  destinations: SelectedPatientDestination[],
) => {
  const names = [
    ...new Set(
      destinations
        .map((destination) => formatNameWords(destination.patientName))
        .filter((name) => name.length > 0),
    ),
  ];

  if (names.length === 0) {
    return "selected patients";
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

  const patientName = formatPatientNameFromParts(
    patient.firstName,
    patient.lastName,
  ).toLowerCase();
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
