import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { responsiveStyles } from "./responsiveStyles";
import type { WeeklyWorkingHours } from "../../../shared/contracts";
import { usePatientSearch } from "./hooks/usePatientSearch";
import { useRouteOptimization } from "./hooks/useRouteOptimization";
import {
  persistPlanningWindows,
  resolveWorkingHoursForDate,
} from "./routePlanner/routePlannerService";
import { patientMatchesSearchQuery } from "./routePlanner/routePlannerHelpers";
import {
  buildOptimizeDestinations,
  buildPlanningWindowsToPersist,
  validateRequestDestinations,
} from "./routePlanner/routePlannerSubmission";
import { PatientFormModal } from "./modals/PatientFormModal";
import {
  type MobilePlannerStep,
  readRoutePlannerDraft,
  persistRoutePlannerDraft,
} from "./routePlanner/routePlannerDraft";
import { useManualReorder } from "./hooks/useManualReorder";
import { useCreatePatientForm } from "./hooks/useCreatePatientForm";
import { useRoutePlannerDestinations } from "./hooks/useRoutePlannerDestinations";
import { useRoutePlannerAddresses } from "./hooks/useRoutePlannerAddresses";
import { TripSetupSection } from "./routePlanner/TripSetupSection";
import { PatientSelectorSection } from "./routePlanner/PatientSelectorSection";
import { RouteResultSection } from "./routePlanner/RouteResultSection";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

const defaultPlanningDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type RoutePlannerProps = {
  nurseHomeAddress?: string | null;
  nurseWorkingHours?: WeeklyWorkingHours | null;
  nurseBreakGapThresholdMinutes?: number | null;
  onOpenAccountSettings?: () => void;
  optimizationObjective?: "time" | "distance";
};

function RoutePlanner({
  nurseHomeAddress = null,
  nurseWorkingHours,
  nurseBreakGapThresholdMinutes,
  onOpenAccountSettings,
  optimizationObjective = "distance",
}: RoutePlannerProps) {
  const initialDraft = useMemo(() => readRoutePlannerDraft(), []);
  const normalizedHomeAddress = nurseHomeAddress?.trim() ?? "";
  const [planningDate, setPlanningDate] = useState<string>(
    initialDraft?.planningDate ?? defaultPlanningDate(),
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
    destinationSearchQuery,
    setDestinationSearchQuery,
    selectedDestinations,
    expandedDestinationVisitKeys,
    addDestinationPatient,
    removeDestinationVisit,
    toggleDestinationDetails,
    updateDestinationPlanningWindow,
    setDestinationVisitIncluded,
    setDestinationPersistPlanningWindow,
    destinationCount,
    requestDestinations,
    selectedDestinationIdSet,
  } = useRoutePlannerDestinations({ initialDestinations: initialDraft?.selectedDestinations });

  const {
    startAddress,
    manualEndAddress,
    startGooglePlaceId,
    manualEndGooglePlaceId,
    setStartTouched,
    setEndTouched,
    handleStartAddressChange,
    handleStartAddressPick,
    handleManualEndAddressChange,
    handleManualEndAddressPick,
    resolvedEndAddress,
    resolvedEndGooglePlaceId,
    canOptimize,
    hasValidTripAddresses,
    startFieldError,
    endFieldError,
    optimizeEndpointHint,
  } = useRoutePlannerAddresses({ initialDraft, normalizedHomeAddress, hasAttemptedOptimize });

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
    orderedStops: manuallyOrderedStops,
    isStale: isManualOrderStale,
    moveStop,
    canMoveStop,
    resetOrder,
  } = useManualReorder(result);

  const [localValidationError, setLocalValidationError] = useState("");
  const [expandedResultTaskIds, setExpandedResultTaskIds] = useState<Record<string, boolean>>({});
  const [expandedResultEndingStopIds, setExpandedResultEndingStopIds] = useState<
    Record<string, boolean>
  >({});
  const [conflictWarningsDismissed, setConflictWarningsDismissed] = useState(false);
  const [latenessWarningsDismissed, setLatenessWarningsDismissed] = useState(false);
  const [isPatientSearchExpanded, setIsPatientSearchExpanded] = useState(
    (initialDraft?.selectedDestinations?.length ?? 0) === 0,
  );
  const [isTripSetupExpanded, setIsTripSetupExpanded] = useState(
    normalizedHomeAddress.length === 0,
  );

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
      (d) => d.isIncluded && !scheduledKeys.has(`${d.patientId}:${d.windowStart}:${d.windowEnd}`),
    ).length;
  }, [isManualOrderStale, result, manuallyOrderedStops, selectedDestinations]);

  useEffect(() => {
    if (result) {
      setIsPatientSearchExpanded(false);
      setIsTripSetupExpanded(false);
    }
  }, [result]);

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
      planningDate,
    });
  }, [
    activeMobileStep,
    manualEndAddress,
    manualEndGooglePlaceId,
    planningDate,
    selectedDestinations,
    startAddress,
    startGooglePlaceId,
  ]);

  const destinationSearchResults = useMemo(() => {
    const byId = new Map();
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

  const lastOptimizedSnapshotRef = useRef<string | null>(null);

  const currentOptimizeSnapshot = [
    planningDate,
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

  const isHomeAddressMissing = normalizedHomeAddress.length === 0;

  const activeWorkingHoursConstraint = useMemo(() => {
    if (!result || !nurseWorkingHours) return null;
    const resolved = resolveWorkingHoursForDate(
      nurseWorkingHours,
      planningDate,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (!resolved || resolved.dayDisabled) return null;
    return resolved.constraint;
  }, [result, nurseWorkingHours, planningDate]);

  useEffect(() => {
    setConflictWarningsDismissed(false);
    setLatenessWarningsDismissed(false);
  }, [result]);

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

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId ? { endGooglePlaceId: resolvedEndGooglePlaceId } : {}),
      destinations: optimizeDestinations,
      canOptimize,
      planningDate,
      workingHours: nurseWorkingHours ?? null,
      optimizationObjective,
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

    // Re-submit any included destinations that were previously unscheduled
    // (absent from the manual-ordered stop list) so the backend can attempt
    // to fit them in the new order.
    const scheduledKeys = new Set(
      destinationsInManualOrder.map((d) => `${d.patientId}:${d.windowStart}:${d.windowEnd}`),
    );
    const unscheduledDestinations = selectedDestinations
      .filter(
        (d) => d.isIncluded && !scheduledKeys.has(`${d.patientId}:${d.windowStart}:${d.windowEnd}`),
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
      ...(resolvedEndGooglePlaceId ? { endGooglePlaceId: resolvedEndGooglePlaceId } : {}),
      destinations: [...destinationsInManualOrder, ...unscheduledDestinations],
      canOptimize,
      planningDate,
      preserveOrder: true,
      workingHours: nurseWorkingHours ?? null,
      optimizationObjective,
    });
  };

  const isTripStepVisible = !isMobileViewport || activeMobileStep === "trip";
  const isPatientsStepVisible = !isMobileViewport || activeMobileStep === "patients";
  const isReviewStepVisible = !isMobileViewport || activeMobileStep === "review";

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h1 className={responsiveStyles.pageTitle}>Smart Route Planner</h1>
          </div>
          <p className={responsiveStyles.cardDescription}>
            Enter your starting point, ending point, and destination addresses. The planner
            prioritizes time-window feasibility first, then distance, with the ending point as the
            final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          {isMobileViewport && (
            <nav aria-label="Route planner steps" className={responsiveStyles.mobileStepNav}>
              {[
                { key: "trip", label: "Trip", stepNumber: 1, isComplete: hasValidTripAddresses },
                {
                  key: "patients",
                  label: "Patients",
                  stepNumber: 2,
                  isComplete: selectedDestinations.length > 0,
                },
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
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className={responsiveStyles.stepCheckIcon}
                        >
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
            planningDate={planningDate}
            onPlanningDateChange={setPlanningDate}
          />

          <div className="mt-2">
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
              hasResult={!!result}
              isLoading={isLoading}
              canOptimize={canOptimize}
              hasChangedSinceLastOptimize={hasChangedSinceLastOptimize}
              showOptimizeSuccess={showOptimizeSuccess}
              optimizationObjective={optimizationObjective}
            />
          </div>

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
            onToggleResultTask={(taskId) =>
              setExpandedResultTaskIds((c) => ({ ...c, [taskId]: !c[taskId] }))
            }
            expandedResultEndingStopIds={expandedResultEndingStopIds}
            onToggleResultEndingStop={(stopId) =>
              setExpandedResultEndingStopIds((c) => ({ ...c, [stopId]: !c[stopId] }))
            }
            normalizedHomeAddress={normalizedHomeAddress}
            breakGapThresholdMinutes={nurseBreakGapThresholdMinutes ?? undefined}
            workStart={activeWorkingHoursConstraint?.workStart}
            workEnd={activeWorkingHoursConstraint?.workEnd}
            lunchStartTime={activeWorkingHoursConstraint?.lunchStartTime}
            lunchDurationMinutes={activeWorkingHoursConstraint?.lunchDurationMinutes}
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
