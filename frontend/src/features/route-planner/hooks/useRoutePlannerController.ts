import { useEffect, useMemo, useState } from "react";
import type { WeeklyWorkingHours } from "../../../../../shared/contracts";
import { usePatientSearch } from "./usePatientSearch";
import { useRouteOptimization } from "./useRouteOptimization";
import { resolveWorkingHoursForDate } from "../api/routePlannerService";
import { patientMatchesSearchQuery } from "../domain/routePlannerHelpers";
import { readRoutePlannerDraft, type MobilePlannerStep } from "../state/routePlannerDraft";
import { useManualReorder } from "./useManualReorder";
import { useCreatePatientForm } from "./useCreatePatientForm";
import { useRoutePlannerDestinations } from "./useRoutePlannerDestinations";
import { useRoutePlannerAddresses } from "./useRoutePlannerAddresses";
import { useRoutePlannerDraftState } from "./useRoutePlannerDraftState";
import { useRoutePlannerOptimizationState } from "./useRoutePlannerOptimizationState";
import { useRoutePlannerWarningsState } from "./useRoutePlannerWarningsState";

const defaultPlanningDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type UseRoutePlannerControllerParams = {
  nurseHomeAddress?: string | null;
  nurseWorkingHours?: WeeklyWorkingHours | null;
  nurseBreakGapThresholdMinutes?: number | null;
  onOpenAccountSettings?: () => void;
  optimizationObjective: "time" | "distance";
};

export function useRoutePlannerController({
  nurseHomeAddress,
  nurseWorkingHours,
  nurseBreakGapThresholdMinutes,
  onOpenAccountSettings,
  optimizationObjective,
}: UseRoutePlannerControllerParams) {
  const initialDraft = useMemo(() => readRoutePlannerDraft(), []);
  const normalizedHomeAddress = nurseHomeAddress?.trim() ?? "";

  const {
    result,
    error,
    isLoading,
    isRecalculating,
    showOptimizeSuccess,
    showOptimizeFlash,
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
  } = useRoutePlannerDestinations({ initialDestinations: [] });

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

  const [isPatientSearchExpanded, setIsPatientSearchExpanded] = useState(
    (initialDraft?.selectedDestinationStates?.length ?? 0) === 0,
  );
  const [isTripSetupExpanded, setIsTripSetupExpanded] = useState(
    normalizedHomeAddress.length === 0,
  );

  useEffect(() => {
    if (result) {
      setIsPatientSearchExpanded(false);
      setIsTripSetupExpanded(false);
    }
  }, [result]);

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

  const { planningDate, setPlanningDate, isMobileViewport, activeMobileStep, setActiveMobileStep } =
    useRoutePlannerDraftState({
      initialDraft,
      resolveDefaultPlanningDate: defaultPlanningDate,
      startAddress,
      manualEndAddress,
      startGooglePlaceId,
      manualEndGooglePlaceId,
      selectedDestinations,
      destinationSearchPatients,
      isDestinationSearchLoading,
      locallyCreatedPatients,
      selectedDestinationIdSet,
      addDestinationPatient,
      setDestinationVisitIncluded,
      setDestinationPersistPlanningWindow,
    });

  const {
    plannerOptimizationObjective,
    setPlannerOptimizationObjective,
    localValidationError,
    hasChangedSinceLastOptimize,
    unscheduledResubmitCount,
    handleSubmit,
    handleRecalculateManualOrder,
  } = useRoutePlannerOptimizationState({
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
    onOptimizationStarted: () => setIsPatientSearchExpanded(false),
  });

  const {
    expandedResultTaskIds,
    expandedResultEndingStopIds,
    conflictWarningsDismissed,
    latenessWarningsDismissed,
    dismissConflictWarnings,
    dismissLatenessWarnings,
    toggleResultTask,
    toggleResultEndingStop,
  } = useRoutePlannerWarningsState({ result });

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

  const isTripStepVisible = !isMobileViewport || activeMobileStep === "trip";
  const isPatientsStepVisible = !isMobileViewport || activeMobileStep === "patients";
  const isReviewStepVisible = !isMobileViewport || activeMobileStep === "review";

  const mobileSteps: Array<{
    key: MobilePlannerStep;
    label: string;
    stepNumber: number;
    isComplete: boolean;
  }> = [
    { key: "trip", label: "Trip", stepNumber: 1, isComplete: hasValidTripAddresses },
    {
      key: "patients",
      label: "Clients",
      stepNumber: 2,
      isComplete: selectedDestinations.length > 0,
    },
    { key: "review", label: "Review", stepNumber: 3, isComplete: false },
  ];

  const tripSetupSectionProps = {
    isVisible: isTripStepVisible,
    isMobileViewport,
    isExpanded: isTripSetupExpanded,
    onSetExpanded: setIsTripSetupExpanded,
    startAddress,
    resolvedEndAddress,
    manualEndAddress,
    startFieldError,
    endFieldError,
    isHomeAddressMissing,
    onStartAddressChange: handleStartAddressChange,
    onStartAddressPick: handleStartAddressPick,
    onEndAddressChange: handleManualEndAddressChange,
    onEndAddressPick: handleManualEndAddressPick,
    onStartBlur: () => setStartTouched(true),
    onEndBlur: () => setEndTouched(true),
    onOpenAccountSettings,
    planningDate,
    onPlanningDateChange: setPlanningDate,
  };

  const patientSelectorSectionProps = {
    isVisible: isPatientsStepVisible,
    isMobileViewport,
    isExpanded: isPatientSearchExpanded,
    onSetExpanded: setIsPatientSearchExpanded,
    destinationCount,
    destinationSearchResults,
    destinationSearchQuery,
    onSearchQueryChange: setDestinationSearchQuery,
    isSearchLoading: isDestinationSearchLoading,
    searchError: destinationSearchError ?? "",
    createPatientError: createPatientError ?? "",
    selectedDestinations,
    expandedDestinationVisitKeys,
    onAddPatient: addDestinationPatient,
    onOpenCreatePatient: openCreatePatientModal,
    onToggleDestinationDetails: toggleDestinationDetails,
    onRemoveDestinationVisit: removeDestinationVisit,
    onSetDestinationVisitIncluded: setDestinationVisitIncluded,
    onUpdateDestinationPlanningWindow: updateDestinationPlanningWindow,
    onSetDestinationPersistPlanningWindow: setDestinationPersistPlanningWindow,
    hasResult: !!result,
    isLoading,
    canOptimize,
    hasChangedSinceLastOptimize,
    showOptimizeSuccess,
    optimizationObjective: plannerOptimizationObjective,
    defaultOptimizationObjective: optimizationObjective,
    onOptimizationObjectiveChange: setPlannerOptimizationObjective,
  };

  const routeResultSectionProps = {
    isMobileViewport,
    activeMobileStep,
    onSetActiveMobileStep: setActiveMobileStep,
    isReviewStepVisible,
    hasValidTripAddresses,
    destinationCount,
    selectedDestinationsCount: selectedDestinations.length,
    resolvedEndAddress,
    isLoading,
    canOptimize,
    result,
    hasChangedSinceLastOptimize,
    showOptimizeSuccess,
    showOptimizeFlash,
    optimizeEndpointHint,
    localValidationError,
    optimizeError: error ?? "",
    orderedStops: manuallyOrderedStops,
    routeLegs: result?.routeLegs ?? [],
    isManualOrderStale,
    unscheduledResubmitCount,
    onMoveStop: moveStop,
    canMoveStop,
    onResetManualOrder: resetOrder,
    onRecalculateManualOrder: handleRecalculateManualOrder,
    isRecalculatingManualOrder: isRecalculating,
    conflictWarningsDismissed,
    onDismissConflictWarnings: dismissConflictWarnings,
    latenessWarningsDismissed,
    onDismissLatenessWarnings: dismissLatenessWarnings,
    expandedResultTaskIds,
    onToggleResultTask: toggleResultTask,
    expandedResultEndingStopIds,
    onToggleResultEndingStop: toggleResultEndingStop,
    normalizedHomeAddress,
    breakGapThresholdMinutes: nurseBreakGapThresholdMinutes ?? undefined,
    workStart: activeWorkingHoursConstraint?.workStart,
    workEnd: activeWorkingHoursConstraint?.workEnd,
    lunchStartTime: activeWorkingHoursConstraint?.lunchStartTime,
    lunchDurationMinutes: activeWorkingHoursConstraint?.lunchDurationMinutes,
    planningDate,
  };

  const patientFormModalProps = {
    formMode: "create" as const,
    formValues: createPatientFormValues,
    formErrors: createPatientFormErrors,
    isOpen: isCreatePatientModalOpen,
    isSubmitting: isCreatingPatient,
    selectedPatient: null,
    onClose: closeCreatePatientModal,
    onSubmit: handleCreatePatientSubmit,
    onFieldChange: handleCreatePatientFieldChange,
    onVisitWindowChange: handleCreatePatientVisitWindowChange,
    onAddVisitWindow: handleAddCreatePatientVisitWindow,
    onRemoveVisitWindow: handleRemoveCreatePatientVisitWindow,
    selectedVisitType: selectedCreateVisitType,
    onVisitTypeChange: handleCreatePatientVisitTypeChange,
    onAddressChange: handleCreatePatientAddressChange,
    onAddressPick: handleCreatePatientAddressPick,
  };

  return {
    handleSubmit,
    isMobileViewport,
    activeMobileStep,
    setActiveMobileStep,
    mobileSteps,
    tripSetupSectionProps,
    patientSelectorSectionProps,
    routeResultSectionProps,
    patientFormModalProps,
  };
}
