import type {
  OptimizeRouteDestinationInput,
  PersistPlanningWindowInput,
} from "./routePlannerService";
import { timeToMinutes } from "./routePlannerResultUtils";
import {
  formatPatientListLabel,
  hasAnyWindowBoundary,
  hasCompleteWindow,
} from "./routePlannerHelpers";
import type { SelectedPatientDestination } from "./routePlannerTypes";

export const validateRequestDestinations = (
  requestDestinations: SelectedPatientDestination[],
): string | null => {
  const fixedDestinationsMissingWindow = requestDestinations.filter(
    (destination) => destination.windowType === "fixed" && !hasCompleteWindow(destination),
  );
  if (fixedDestinationsMissingWindow.length > 0) {
    return `Set start and end time before optimizing for fixed visits: ${formatPatientListLabel(fixedDestinationsMissingWindow)}.`;
  }

  const flexibleDestinationsWithPartialWindow = requestDestinations.filter(
    (destination) =>
      destination.windowType === "flexible" &&
      hasAnyWindowBoundary(destination) &&
      !hasCompleteWindow(destination),
  );
  if (flexibleDestinationsWithPartialWindow.length > 0) {
    return `Set both start and end time (or clear both) before optimizing for: ${formatPatientListLabel(flexibleDestinationsWithPartialWindow)}.`;
  }

  const destinationsWithInvalidWindowOrder = requestDestinations.filter(
    (destination) =>
      hasCompleteWindow(destination) &&
      timeToMinutes(destination.windowEnd) <= timeToMinutes(destination.windowStart),
  );
  if (destinationsWithInvalidWindowOrder.length > 0) {
    return `Visit end time must be later than start time for: ${formatPatientListLabel(destinationsWithInvalidWindowOrder)}.`;
  }

  const destinationsMissingPersistWindow = requestDestinations.filter(
    (destination) => destination.persistPlanningWindow && !hasCompleteWindow(destination),
  );
  if (destinationsMissingPersistWindow.length > 0) {
    return `Set start and end time before saving to patient record for: ${formatPatientListLabel(destinationsMissingPersistWindow)}.`;
  }

  return null;
};

export const buildOptimizeDestinations = (
  requestDestinations: SelectedPatientDestination[],
): OptimizeRouteDestinationInput[] =>
  requestDestinations.map(
    ({
      visitKey: _visitKey,
      sourceWindowId: _sourceWindowId,
      requiresPlanningWindow: _requiresPlanningWindow,
      isIncluded: _isIncluded,
      persistPlanningWindow: _persistPlanningWindow,
      ...destination
    }) => destination,
  );

export const buildPlanningWindowsToPersist = (
  requestDestinations: SelectedPatientDestination[],
): PersistPlanningWindowInput[] =>
  requestDestinations
    .filter((destination) => destination.persistPlanningWindow && hasCompleteWindow(destination))
    .map((destination) => ({
      patientId: destination.patientId,
      sourceWindowId: destination.sourceWindowId,
      startTime: destination.windowStart,
      endTime: destination.windowEnd,
      visitTimeType: destination.windowType,
    }));
