import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { responsiveStyles } from "./responsiveStyles";
import type { Patient } from "../../../shared/contracts";
import { usePatientSearch } from "./hooks/usePatientSearch";
import { useRouteOptimization } from "./hooks/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import type { SelectedPatientDestination } from "./routePlanner/routePlannerTypes";
import {
  patientMatchesSearchQuery,
  toSelectedPatientDestinations,
} from "./routePlanner/routePlannerHelpers";
import {
  buildOptimizeDestinations,
  buildPlanningWindowsToPersist,
  validateRequestDestinations,
} from "./routePlanner/routePlannerSubmission";
import type { AddressSuggestion } from "./types";
import { PatientFormModal } from "./patients/PatientFormModal";
import {
  type MobilePlannerStep,
  readRoutePlannerDraft,
  persistRoutePlannerDraft,
} from "./routePlanner/routePlannerDraft";
import { useManualReorder } from "./hooks/useManualReorder";
import { useCreatePatientForm } from "./hooks/useCreatePatientForm";
import { TripSetupSection } from "./routePlanner/TripSetupSection";
import { PatientSelectorSection } from "./routePlanner/PatientSelectorSection";
import { RouteResultSection } from "./routePlanner/RouteResultSection";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const DEFAULT_START_ADDRESS = "3361 Ingram Road, Mississauga, ON";

type RoutePlannerProps = {
  nurseHomeAddress?: string | null;
  onOpenAccountSettings?: () => void;
};

function RoutePlanner({
  nurseHomeAddress = null,
  onOpenAccountSettings,
}: RoutePlannerProps) {
  const initialDraft = useMemo(() => readRoutePlannerDraft(), []);
  const normalizedHomeAddress = nurseHomeAddress?.trim() ?? "";
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const [activeMobileStep, setActiveMobileStep] = useState<MobilePlannerStep>(
    initialDraft?.activeMobileStep ?? "trip",
  );
  const [startAddress, setStartAddress] = useState(
    initialDraft?.startAddress ??
      (normalizedHomeAddress.length > 0
        ? normalizedHomeAddress
        : DEFAULT_START_ADDRESS),
  );
  const [manualEndAddress, setManualEndAddress] = useState(
    initialDraft?.manualEndAddress ?? normalizedHomeAddress,
  );
  const [startGooglePlaceId, setStartGooglePlaceId] = useState<string | null>(
    initialDraft?.startGooglePlaceId ?? null,
  );
  const [manualEndGooglePlaceId, setManualEndGooglePlaceId] = useState<
    string | null
  >(initialDraft?.manualEndGooglePlaceId ?? null);

  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [localValidationError, setLocalValidationError] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<
    SelectedPatientDestination[]
  >(initialDraft?.selectedDestinations ?? []);
  const [expandedDestinationVisitKeys, setExpandedDestinationVisitKeys] =
    useState<Record<string, boolean>>({});
  const [expandedResultTaskIds, setExpandedResultTaskIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedResultEndingStopIds, setExpandedResultEndingStopIds] =
    useState<Record<string, boolean>>({});
  const [conflictWarningsDismissed, setConflictWarningsDismissed] =
    useState(false);
  const [latenessWarningsDismissed, setLatenessWarningsDismissed] =
    useState(false);
const [isPatientSearchExpanded, setIsPatientSearchExpanded] = useState(
    (initialDraft?.selectedDestinations?.length ?? 0) === 0,
  );
  const [isTripSetupExpanded, setIsTripSetupExpanded] = useState(
    normalizedHomeAddress.length === 0,
  );

  const addDestinationPatient = (patient: Patient) => {
    const destinations = toSelectedPatientDestinations(patient);
    if (destinations.length === 0) {
      return;
    }

    setSelectedDestinations((current) => {
      if (current.some((entry) => entry.patientId === patient.id)) {
        return current;
      }

      return [...current, ...destinations];
    });
    setExpandedDestinationVisitKeys((current) => {
      const next = { ...current };
      destinations.forEach((destination) => {
        next[destination.visitKey] = false;
      });
      return next;
    });
    setDestinationSearchQuery("");
  };

  const {
    locallyCreatedPatients,
    isCreatePatientModalOpen,
    createPatientFormValues,
    createPatientFormErrors,
    isCreatingPatient,
    createPatientError,
    selectedCreateVisitType,
    openCreatePatientModal,
    closeCreatePatientModal,
    handleCreatePatientFieldChange,
    handleCreatePatientVisitWindowChange,
    handleAddCreatePatientVisitWindow,
    handleRemoveCreatePatientVisitWindow,
    handleCreatePatientVisitTypeChange,
    handleCreatePatientAddressChange,
    handleCreatePatientAddressPick,
    handleCreatePatientSubmit,
  } = useCreatePatientForm({
    onPatientCreated: addDestinationPatient,
  });

  const {
    patients: destinationSearchPatients,
    isLoading: isDestinationSearchLoading,
    error: destinationSearchError,
  } = usePatientSearch({
    query: destinationSearchQuery,
    enabled: true,
  });

  const {
    result,
    error,
    isLoading,
    isRecalculating,
    showOptimizeSuccess,
    hasAttemptedOptimize,
    optimizeRoute,
  } = useRouteOptimization();
  const {
    orderedStops: manuallyOrderedStops,
    isStale: isManualOrderStale,
    moveStop,
    canMoveStop,
    resetOrder,
  } = useManualReorder(result);

  // Count of included destinations absent from the current manual-ordered stop list.
  // These were previously unscheduled and will be re-submitted on recalculate.
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
      (d) =>
        d.isIncluded &&
        !scheduledKeys.has(`${d.patientId}:${d.windowStart}:${d.windowEnd}`),
    ).length;
  }, [isManualOrderStale, result, manuallyOrderedStops, selectedDestinations]);

  useEffect(() => {
    if (result) {
      setIsPatientSearchExpanded(false);
      setIsTripSetupExpanded(false);
    }
  }, [result]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
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
    if (initialDraft) {
      return;
    }

    if (normalizedHomeAddress.length === 0) {
      return;
    }

    if (
      startAddress.trim().length === 0 ||
      startAddress === DEFAULT_START_ADDRESS
    ) {
      setStartAddress(normalizedHomeAddress);
      setStartGooglePlaceId(null);
    }

    if (manualEndAddress.trim().length === 0) {
      setManualEndAddress(normalizedHomeAddress);
      setManualEndGooglePlaceId(null);
    }
  }, [initialDraft, manualEndAddress, normalizedHomeAddress, startAddress]);

  useEffect(() => {
    setExpandedDestinationVisitKeys((current) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      selectedDestinations.forEach((destination) => {
        const existing = current[destination.visitKey];
        if (existing === undefined) {
          next[destination.visitKey] = false;
          changed = true;
          return;
        }

        next[destination.visitKey] = existing;
      });

      if (
        !changed &&
        Object.keys(current).length !== selectedDestinations.length
      ) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [selectedDestinations]);

  useEffect(() => {
    setExpandedResultTaskIds({});
    setExpandedResultEndingStopIds({});
  }, [result]);

  useEffect(() => {
    persistRoutePlannerDraft({
      version: 1,
      startAddress,
      manualEndAddress,
      startGooglePlaceId,
      manualEndGooglePlaceId,
      activeMobileStep,
      selectedDestinations,
    });
  }, [
    activeMobileStep,
    manualEndAddress,
    manualEndGooglePlaceId,
    selectedDestinations,
    startAddress,
    startGooglePlaceId,
  ]);

  const selectedDestinationIdSet = useMemo(
    () =>
      new Set(selectedDestinations.map((destination) => destination.patientId)),
    [selectedDestinations],
  );

  const destinationSearchResults = useMemo(() => {
    const byId = new Map<string, Patient>();
    destinationSearchPatients.forEach((patient) => {
      byId.set(patient.id, patient);
    });
    locallyCreatedPatients.forEach((patient) => {
      byId.set(patient.id, patient);
    });

    return [...byId.values()].filter((patient) => {
      if (selectedDestinationIdSet.has(patient.id)) {
        return false;
      }

      return patientMatchesSearchQuery(patient, destinationSearchQuery);
    });
  }, [
    destinationSearchPatients,
    destinationSearchQuery,
    locallyCreatedPatients,
    selectedDestinationIdSet,
  ]);

  const resolvedEndAddress = manualEndAddress;
  const resolvedEndGooglePlaceId = manualEndGooglePlaceId;

  const canOptimize =
    startAddress.trim().length > 0 && resolvedEndAddress.trim().length > 0;

  const hasValidTripAddresses = canOptimize;

  const lastOptimizedSnapshotRef = useRef<string | null>(null);

  const currentOptimizeSnapshot = [
    startAddress,
    resolvedEndAddress,
    selectedDestinations
      .filter((d) => d.isIncluded)
      .map((d) => `${d.visitKey}:${d.windowStart}:${d.windowEnd}`)
      .sort()
      .join(","),
  ].join("||");

  const hasChangedSinceLastOptimize =
    lastOptimizedSnapshotRef.current === null ||
    lastOptimizedSnapshotRef.current !== currentOptimizeSnapshot;

  const optimizeEndpointHint = useMemo(() => {
    if (manualEndAddress.trim().length === 0) {
      return "Select an ending point to enable route optimization.";
    }
    return undefined;
  }, [manualEndAddress]);

  const startFieldError =
    (hasAttemptedOptimize || startTouched) && startAddress.trim().length === 0
      ? "Starting point is required."
      : undefined;

  const endFieldError = useMemo(() => {
    if (!(hasAttemptedOptimize || endTouched)) {
      return undefined;
    }

    if (manualEndAddress.trim().length === 0) {
      return "Ending point is required.";
    }
    return undefined;
  }, [endTouched, hasAttemptedOptimize, manualEndAddress]);

  const isHomeAddressMissing = normalizedHomeAddress.length === 0;

  useEffect(() => {
    setConflictWarningsDismissed(false);
    setLatenessWarningsDismissed(false);
  }, [result]);

  const requestDestinations = useMemo(() => {
    return selectedDestinations.filter((destination) => destination.isIncluded);
  }, [selectedDestinations]);

  const handleStartAddressChange = (value: string) => {
    setStartAddress(value);
    setStartGooglePlaceId(null);
  };

  const handleStartAddressPick = (suggestion: AddressSuggestion) => {
    setStartAddress(suggestion.displayName);
    setStartGooglePlaceId(suggestion.placeId);
  };

  const handleManualEndAddressChange = (value: string) => {
    setManualEndAddress(value);
    setManualEndGooglePlaceId(null);
  };

  const handleManualEndAddressPick = (suggestion: AddressSuggestion) => {
    setManualEndAddress(suggestion.displayName);
    setManualEndGooglePlaceId(suggestion.placeId);
  };

  const updateDestinationPlanningWindow = (
    visitKey: string,
    field: "windowStart" | "windowEnd",
    value: string,
  ) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey
          ? {
              ...destination,
              [field]: value,
            }
          : destination,
      ),
    );
  };

  const setDestinationVisitIncluded = (
    visitKey: string,
    isIncluded: boolean,
  ) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey
          ? {
              ...destination,
              isIncluded,
            }
          : destination,
      ),
    );
  };

  const setDestinationPersistPlanningWindow = (
    visitKey: string,
    persistPlanningWindow: boolean,
  ) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey
          ? {
              ...destination,
              persistPlanningWindow,
            }
          : destination,
      ),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalValidationError("");

    const validationError = validateRequestDestinations(requestDestinations);
    if (validationError) {
      setLocalValidationError(validationError);
      return;
    }

    const optimizeDestinations = buildOptimizeDestinations(requestDestinations);
    const planningWindowsToPersist =
      buildPlanningWindowsToPersist(requestDestinations);

    if (planningWindowsToPersist.length > 0) {
      try {
        await persistPlanningWindows(planningWindowsToPersist);
      } catch (error) {
        setLocalValidationError(
          error instanceof Error
            ? error.message
            : "Unable to save planning windows.",
        );
        return;
      }
    }

    lastOptimizedSnapshotRef.current = currentOptimizeSnapshot;

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId
        ? { endGooglePlaceId: resolvedEndGooglePlaceId }
        : {}),
      destinations: optimizeDestinations,
      canOptimize,
    });
  };

  const handleRecalculateManualOrder = async () => {
    if (!result || !isManualOrderStale) {
      return;
    }

    // Extract the planning date from the result's departure time. The ISO string
    // encodes the local planning timezone, so the date portion is correct as-is.
    const planningDate = result.start.departureTime.slice(0, 10);

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

    // Re-submit any included destinations that were previously unscheduled
    // (absent from the manual-ordered stop list) so the backend can attempt
    // to fit them in the new order.
    const scheduledKeys = new Set(
      destinationsInManualOrder.map(
        (d) => `${d.patientId}:${d.windowStart}:${d.windowEnd}`,
      ),
    );
    const unscheduledDestinations = selectedDestinations
      .filter(
        (d) =>
          d.isIncluded &&
          !scheduledKeys.has(`${d.patientId}:${d.windowStart}:${d.windowEnd}`),
      )
      .map((d) => ({
        patientId: d.patientId,
        patientName: d.patientName,
        address: d.address,
        googlePlaceId: d.googlePlaceId,
        windowStart: d.windowStart,
        windowEnd: d.windowEnd,
        windowType: d.windowType,
        serviceDurationMinutes: d.serviceDurationMinutes,
      }));

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId
        ? { endGooglePlaceId: resolvedEndGooglePlaceId }
        : {}),
      destinations: [...destinationsInManualOrder, ...unscheduledDestinations],
      canOptimize,
      planningDate,
      preserveOrder: true,
    });
  };

  const removeDestinationVisit = (visitKey: string) => {
    setSelectedDestinations((current) =>
      current.filter((entry) => entry.visitKey !== visitKey),
    );
    setExpandedDestinationVisitKeys((current) => {
      if (current[visitKey] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[visitKey];
      return next;
    });
  };

  const toggleDestinationDetails = (visitKey: string) => {
    setExpandedDestinationVisitKeys((current) => ({
      ...current,
      [visitKey]: !(current[visitKey] ?? false),
    }));
  };

  const destinationCount = selectedDestinations.filter(
    (destination) => destination.isIncluded,
  ).length;
  const isTripStepVisible = !isMobileViewport || activeMobileStep === "trip";
  const isPatientsStepVisible =
    !isMobileViewport || activeMobileStep === "patients";
  const isReviewStepVisible =
    !isMobileViewport || activeMobileStep === "review";

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h1 className={responsiveStyles.pageTitle}>Smart Route Planner</h1>
          </div>
          <p className={responsiveStyles.cardDescription}>
            Enter your starting point, ending point, and destination addresses.
            The planner prioritizes time-window feasibility first, then distance,
            with the ending point as the final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          {isMobileViewport && (
            <nav aria-label="Route planner steps" className={responsiveStyles.mobileStepNav}>
              {[
                { key: "trip", label: "Trip", stepNumber: 1, isComplete: hasValidTripAddresses },
                { key: "patients", label: "Patients", stepNumber: 2, isComplete: selectedDestinations.length > 0 },
                { key: "review", label: "Review", stepNumber: 3, isComplete: false },
              ].map((step) => {
                const isActive = activeMobileStep === step.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveMobileStep(step.key as MobilePlannerStep)}
                    className={`${responsiveStyles.mobileStepButton} ${isActive ? responsiveStyles.mobileStepButtonActive : responsiveStyles.mobileStepButtonInactive}`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {step.isComplete && !isActive ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={responsiveStyles.stepCheckIcon}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className={responsiveStyles.stepNumberBadge}>{step.stepNumber}</span>
                      )}
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          <TripSetupSection
            isVisible={isTripStepVisible}
            isMobileViewport={isMobileViewport}
            isExpanded={isTripSetupExpanded}
            onSetExpanded={setIsTripSetupExpanded}
            startAddress={startAddress}
            resolvedEndAddress={resolvedEndAddress}
            manualEndAddress={manualEndAddress}
            startFieldError={startFieldError}
            endFieldError={endFieldError}
            isHomeAddressMissing={isHomeAddressMissing}
            onStartAddressChange={handleStartAddressChange}
            onStartAddressPick={handleStartAddressPick}
            onEndAddressChange={handleManualEndAddressChange}
            onEndAddressPick={handleManualEndAddressPick}
            onStartBlur={() => setStartTouched(true)}
            onEndBlur={() => setEndTouched(true)}
            onOpenAccountSettings={onOpenAccountSettings}
          />

          <PatientSelectorSection
            isVisible={isPatientsStepVisible}
            isMobileViewport={isMobileViewport}
            isExpanded={isPatientSearchExpanded}
            onSetExpanded={setIsPatientSearchExpanded}
            destinationCount={destinationCount}
            destinationSearchResults={destinationSearchResults}
            destinationSearchQuery={destinationSearchQuery}
            onSearchQueryChange={setDestinationSearchQuery}
            isSearchLoading={isDestinationSearchLoading}
            searchError={destinationSearchError ?? ""}
            createPatientError={createPatientError ?? ""}
            selectedDestinations={selectedDestinations}
            expandedDestinationVisitKeys={expandedDestinationVisitKeys}
            onAddPatient={addDestinationPatient}
            onOpenCreatePatient={openCreatePatientModal}
            onToggleDestinationDetails={toggleDestinationDetails}
            onRemoveDestinationVisit={removeDestinationVisit}
            onSetDestinationVisitIncluded={setDestinationVisitIncluded}
            onUpdateDestinationPlanningWindow={updateDestinationPlanningWindow}
            onSetDestinationPersistPlanningWindow={setDestinationPersistPlanningWindow}
          />

          <RouteResultSection
            isMobileViewport={isMobileViewport}
            activeMobileStep={activeMobileStep}
            onSetActiveMobileStep={setActiveMobileStep}
            isReviewStepVisible={isReviewStepVisible}
            hasValidTripAddresses={hasValidTripAddresses}
            destinationCount={destinationCount}
            selectedDestinationsCount={selectedDestinations.length}
            resolvedEndAddress={resolvedEndAddress}
            isLoading={isLoading}
            canOptimize={canOptimize}
            result={result}
            hasChangedSinceLastOptimize={hasChangedSinceLastOptimize}
            showOptimizeSuccess={showOptimizeSuccess}
            optimizeEndpointHint={optimizeEndpointHint}
            localValidationError={localValidationError}
            optimizeError={error ?? ""}
            orderedStops={manuallyOrderedStops}
            routeLegs={result?.routeLegs ?? []}
            isManualOrderStale={isManualOrderStale}
            unscheduledResubmitCount={unscheduledResubmitCount}
            onMoveStop={moveStop}
            canMoveStop={canMoveStop}
            onResetManualOrder={resetOrder}
            onRecalculateManualOrder={handleRecalculateManualOrder}
            isRecalculatingManualOrder={isRecalculating}
            conflictWarningsDismissed={conflictWarningsDismissed}
            onDismissConflictWarnings={() => setConflictWarningsDismissed(true)}
            latenessWarningsDismissed={latenessWarningsDismissed}
            onDismissLatenessWarnings={() => setLatenessWarningsDismissed(true)}
            expandedResultTaskIds={expandedResultTaskIds}
            onToggleResultTask={(taskId) => setExpandedResultTaskIds((c) => ({ ...c, [taskId]: !c[taskId] }))}
            expandedResultEndingStopIds={expandedResultEndingStopIds}
            onToggleResultEndingStop={(stopId) => setExpandedResultEndingStopIds((c) => ({ ...c, [stopId]: !c[stopId] }))}
            normalizedHomeAddress={normalizedHomeAddress}
          />
        </form>
      </section>

      <PatientFormModal
        formMode="create"
        formValues={createPatientFormValues}
        formErrors={createPatientFormErrors}
        isOpen={isCreatePatientModalOpen}
        isSubmitting={isCreatingPatient}
        selectedPatient={null}
        onClose={closeCreatePatientModal}
        onSubmit={handleCreatePatientSubmit}
        onFieldChange={handleCreatePatientFieldChange}
        onVisitWindowChange={handleCreatePatientVisitWindowChange}
        onAddVisitWindow={handleAddCreatePatientVisitWindow}
        onRemoveVisitWindow={handleRemoveCreatePatientVisitWindow}
        selectedVisitType={selectedCreateVisitType}
        onVisitTypeChange={handleCreatePatientVisitTypeChange}
        onAddressChange={handleCreatePatientAddressChange}
        onAddressPick={handleCreatePatientAddressPick}
      />
    </main>
  );
}

export default RoutePlanner;
