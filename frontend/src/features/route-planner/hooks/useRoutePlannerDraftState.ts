import { useEffect, useState } from "react";
import type { Patient, VisitInstance } from "../../../../../shared/contracts";
import {
  persistRoutePlannerDraft,
  type MobilePlannerStep,
  type RoutePlannerDraft,
} from "../state/routePlannerDraft";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

type UseRoutePlannerDraftStateParams = {
  initialDraft: RoutePlannerDraft | null;
  resolveDefaultPlanningDate: () => string;
  startAddress: string;
  manualEndAddress: string;
  startGooglePlaceId: string | null;
  manualEndGooglePlaceId: string | null;
  selectedDestinations: SelectedPatientDestination[];
  destinationSearchPatients: Patient[];
  isDestinationSearchLoading: boolean;
  locallyCreatedPatients: Patient[];
  visitInstancesByPatientId: Map<string, VisitInstance[]>;
  selectedDestinationIdSet: Set<string>;
  addDestinationPatient: (patient: Patient, visitInstances?: VisitInstance[]) => void;
  setDestinationVisitIncluded: (visitKey: string, isIncluded: boolean) => void;
  setDestinationPersistPlanningWindow: (visitKey: string, persistPlanningWindow: boolean) => void;
};

export function useRoutePlannerDraftState({
  initialDraft,
  resolveDefaultPlanningDate,
  startAddress,
  manualEndAddress,
  startGooglePlaceId,
  manualEndGooglePlaceId,
  selectedDestinations,
  destinationSearchPatients,
  isDestinationSearchLoading,
  locallyCreatedPatients,
  visitInstancesByPatientId,
  selectedDestinationIdSet,
  addDestinationPatient,
  setDestinationVisitIncluded,
  setDestinationPersistPlanningWindow,
}: UseRoutePlannerDraftStateParams) {
  const [planningDate, setPlanningDate] = useState<string>(
    initialDraft?.planningDate ?? resolveDefaultPlanningDate(),
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const [activeMobileStep, setActiveMobileStep] = useState<MobilePlannerStep>(
    initialDraft?.activeMobileStep ?? "trip",
  );
  const [hasHydratedDraftDestinations, setHasHydratedDraftDestinations] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateMobileViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
      if (!matches) {
        setActiveMobileStep("trip");
      }
    };

    updateMobileViewport(mediaQueryList.matches);

    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      updateMobileViewport(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleMediaQueryChange);
      return () => {
        mediaQueryList.removeEventListener("change", handleMediaQueryChange);
      };
    }

    mediaQueryList.addListener(handleMediaQueryChange);
    return () => {
      mediaQueryList.removeListener(handleMediaQueryChange);
    };
  }, []);

  useEffect(() => {
    const shouldDeferPersistUntilHydration =
      !hasHydratedDraftDestinations && (initialDraft?.selectedDestinationStates?.length ?? 0) > 0;
    if (shouldDeferPersistUntilHydration) {
      return;
    }

    persistRoutePlannerDraft({
      version: 1,
      startAddress,
      manualEndAddress,
      startGooglePlaceId,
      manualEndGooglePlaceId,
      activeMobileStep,
      selectedDestinationStates: selectedDestinations,
      planningDate,
    });
  }, [
    activeMobileStep,
    hasHydratedDraftDestinations,
    initialDraft?.selectedDestinationStates?.length,
    manualEndAddress,
    manualEndGooglePlaceId,
    planningDate,
    selectedDestinations,
    startAddress,
    startGooglePlaceId,
  ]);

  useEffect(() => {
    if (hasHydratedDraftDestinations) {
      return;
    }

    const draftStates = initialDraft?.selectedDestinationStates ?? [];
    if (draftStates.length === 0) {
      setHasHydratedDraftDestinations(true);
      return;
    }

    const patientById = new Map<string, Patient>();
    destinationSearchPatients.forEach((patient) => {
      patientById.set(patient.id, patient);
    });
    locallyCreatedPatients.forEach((patient) => {
      patientById.set(patient.id, patient);
    });

    const uniquePatientIds = [...new Set(draftStates.map((state) => state.patientId))];
    const unresolvedPatientIds = uniquePatientIds.filter(
      (patientId) => !selectedDestinationIdSet.has(patientId) && !patientById.has(patientId),
    );
    if (unresolvedPatientIds.length > 0 && isDestinationSearchLoading) {
      return;
    }

    uniquePatientIds.forEach((patientId) => {
      if (selectedDestinationIdSet.has(patientId)) {
        return;
      }
      const patient = patientById.get(patientId);
      if (!patient) {
        return;
      }
      addDestinationPatient(patient, visitInstancesByPatientId.get(patientId));
    });

    draftStates.forEach((state) => {
      setDestinationVisitIncluded(state.visitKey, state.isIncluded);
      setDestinationPersistPlanningWindow(state.visitKey, state.persistPlanningWindow);
    });

    setHasHydratedDraftDestinations(true);
  }, [
    addDestinationPatient,
    destinationSearchPatients,
    hasHydratedDraftDestinations,
    initialDraft?.selectedDestinationStates,
    isDestinationSearchLoading,
    locallyCreatedPatients,
    visitInstancesByPatientId,
    selectedDestinationIdSet,
    setDestinationPersistPlanningWindow,
    setDestinationVisitIncluded,
  ]);

  return {
    planningDate,
    setPlanningDate,
    isMobileViewport,
    activeMobileStep,
    setActiveMobileStep,
  };
}
