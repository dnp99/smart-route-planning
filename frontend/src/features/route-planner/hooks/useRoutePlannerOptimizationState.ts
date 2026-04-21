import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { WeeklyWorkingHours } from "../../../../../shared/contracts";
import {
  buildOptimizeDestinations,
  buildPlanningWindowsToPersist,
  validateRequestDestinations,
} from "../domain/routePlannerSubmission";
import {
  persistPlanningWindows,
  type OptimizeRouteDestinationInput,
} from "../api/routePlannerService";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";
import type { OptimizeRouteResponse, OrderedStop } from "../types";

type OptimizeRouteActionInput = {
  startAddress: string;
  startGooglePlaceId?: string | null;
  endAddress: string;
  endGooglePlaceId?: string | null;
  destinations: OptimizeRouteDestinationInput[];
  canOptimize: boolean;
  planningDate?: string;
  preserveOrder?: boolean;
  workingHours?: WeeklyWorkingHours | null;
  optimizationObjective?: "time" | "distance";
};

type UseRoutePlannerOptimizationStateParams = {
  optimizationObjective: "time" | "distance";
  planningDate: string;
  startAddress: string;
  startGooglePlaceId: string | null;
  resolvedEndAddress: string;
  resolvedEndGooglePlaceId: string | null;
  selectedDestinations: SelectedPatientDestination[];
  requestDestinations: SelectedPatientDestination[];
  result: OptimizeRouteResponse | null;
  manuallyOrderedStops: OrderedStop[];
  isManualOrderStale: boolean;
  canOptimize: boolean;
  nurseWorkingHours?: WeeklyWorkingHours | null;
  optimizeRoute: (input: OptimizeRouteActionInput) => Promise<void>;
  onOptimizationStarted?: () => void;
};

export function useRoutePlannerOptimizationState({
  optimizationObjective,
  planningDate,
  startAddress,
  startGooglePlaceId,
  resolvedEndAddress,
  resolvedEndGooglePlaceId,
  selectedDestinations,
  requestDestinations,
  result,
  manuallyOrderedStops,
  isManualOrderStale,
  canOptimize,
  nurseWorkingHours,
  optimizeRoute,
  onOptimizationStarted,
}: UseRoutePlannerOptimizationStateParams) {
  const [plannerOptimizationObjective, setPlannerOptimizationObjective] = useState<
    "time" | "distance"
  >(optimizationObjective);
  const [localValidationError, setLocalValidationError] = useState("");
  const lastOptimizedSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    setPlannerOptimizationObjective(optimizationObjective);
  }, [optimizationObjective]);

  const currentOptimizeSnapshot = [
    planningDate,
    plannerOptimizationObjective,
    startAddress,
    resolvedEndAddress,
    selectedDestinations
      .filter((destination) => destination.isIncluded)
      .map(
        (destination) =>
          `${destination.patientId}:${destination.windowStart}:${destination.windowEnd}:${destination.address}`,
      )
      .sort()
      .join(","),
  ].join("||");

  const hasChangedSinceLastOptimize =
    lastOptimizedSnapshotRef.current === null ||
    lastOptimizedSnapshotRef.current !== currentOptimizeSnapshot;

  const unscheduledResubmitCount = useMemo(() => {
    if (!isManualOrderStale || !result) return 0;
    const scheduledKeys = new Set(
      manuallyOrderedStops
        .filter((stop) => !stop.isEndingPoint && stop.tasks.length > 0)
        .flatMap((stop) =>
          stop.tasks.map((task) => `${task.patientId}:${task.windowStart}:${task.windowEnd}`),
        ),
    );

    return selectedDestinations.filter(
      (destination) =>
        destination.isIncluded &&
        !scheduledKeys.has(
          `${destination.patientId}:${destination.windowStart}:${destination.windowEnd}`,
        ),
    ).length;
  }, [isManualOrderStale, manuallyOrderedStops, result, selectedDestinations]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalValidationError("");

    const validationError = validateRequestDestinations(requestDestinations);
    if (validationError) {
      setLocalValidationError(validationError);
      return;
    }

    const optimizeDestinations = buildOptimizeDestinations(requestDestinations);
    const planningWindowsToPersist = buildPlanningWindowsToPersist(requestDestinations);

    if (planningWindowsToPersist.length > 0) {
      try {
        await persistPlanningWindows(planningWindowsToPersist);
      } catch (error) {
        setLocalValidationError(
          error instanceof Error ? error.message : "Unable to save planning windows.",
        );
        return;
      }
    }

    lastOptimizedSnapshotRef.current = currentOptimizeSnapshot;
    onOptimizationStarted?.();

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId ? { endGooglePlaceId: resolvedEndGooglePlaceId } : {}),
      destinations: optimizeDestinations,
      canOptimize,
      planningDate,
      workingHours: nurseWorkingHours ?? null,
      optimizationObjective: plannerOptimizationObjective,
    });
  };

  const handleRecalculateManualOrder = async () => {
    if (!result || !isManualOrderStale) {
      return;
    }

    const destinationsInManualOrder = manuallyOrderedStops
      .filter((stop) => !stop.isEndingPoint && stop.tasks.length > 0)
      .flatMap((stop) =>
        stop.tasks.map((task) => ({
          patientId: task.patientId,
          patientName: task.patientName,
          address: task.address,
          googlePlaceId: task.googlePlaceId ?? null,
          windowStart: task.windowStart,
          windowEnd: task.windowEnd,
          windowType: task.windowType,
          serviceDurationMinutes: task.serviceDurationMinutes,
        })),
      );

    if (destinationsInManualOrder.length === 0) {
      return;
    }

    const scheduledKeys = new Set(
      destinationsInManualOrder.map(
        (destination) =>
          `${destination.patientId}:${destination.windowStart}:${destination.windowEnd}`,
      ),
    );

    const unscheduledDestinations = selectedDestinations
      .filter(
        (destination) =>
          destination.isIncluded &&
          !scheduledKeys.has(
            `${destination.patientId}:${destination.windowStart}:${destination.windowEnd}`,
          ),
      )
      .map((destination) => ({
        patientId: destination.patientId,
        patientName: destination.patientName,
        address: destination.address,
        googlePlaceId: destination.googlePlaceId,
        windowStart: destination.windowStart,
        windowEnd: destination.windowEnd,
        windowType: destination.windowType,
        serviceDurationMinutes: destination.serviceDurationMinutes,
      }));

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId ? { endGooglePlaceId: resolvedEndGooglePlaceId } : {}),
      destinations: [...destinationsInManualOrder, ...unscheduledDestinations],
      canOptimize,
      planningDate,
      preserveOrder: true,
      workingHours: nurseWorkingHours ?? null,
      optimizationObjective: plannerOptimizationObjective,
    });
  };

  return {
    plannerOptimizationObjective,
    setPlannerOptimizationObjective,
    localValidationError,
    hasChangedSinceLastOptimize,
    currentOptimizeSnapshot,
    unscheduledResubmitCount,
    handleSubmit,
    handleRecalculateManualOrder,
  };
}
