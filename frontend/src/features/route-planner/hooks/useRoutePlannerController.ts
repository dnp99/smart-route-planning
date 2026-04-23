import { useEffect, useMemo, useState } from "react";
import type {
  RecurringVisitTemplate,
  VisitInstance,
  WeeklyWorkingHours,
} from "../../../../../shared/contracts";
import { usePatientSearch } from "./usePatientSearch";
import { useRouteOptimization } from "./useRouteOptimization";
import {
  requestExpandVisitInstances,
  requestRecurringVisitTemplates,
  requestVisitInstances,
  resolveWorkingHoursForDate,
} from "../api/routePlannerService";
import {
  patientMatchesSearchQuery,
  toSelectedVisitInstanceDestinations,
} from "../domain/routePlannerHelpers";
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

type TemplatePickerOption = {
  id: string;
  label: string;
  instanceCount: number;
  matchesPlanningDay: boolean;
};

const getPlanningDayOfWeek = (planningDate: string) => {
  return new Date(`${planningDate}T12:00:00`).getDay();
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
    restoreCachedResult,
    optimizeRoute,
  } = useRouteOptimization();

  const {
    destinationSearchQuery,
    setDestinationSearchQuery,
    selectedDestinations,
    expandedDestinationVisitKeys,
    addDestinationPatient,
    replaceSelectedDestinations,
    removeDestinationVisit,
    toggleDestinationDetails,
    updateDestinationPlanningWindow,
    setDestinationVisitIncluded,
    setDestinationPersistPlanningWindow,
    destinationCount,
    requestDestinations,
    selectedDestinationIdSet,
  } = useRoutePlannerDestinations({ initialDestinations: [] });
  const [visitInstancesByPatientId, setVisitInstancesByPatientId] = useState<
    Map<string, VisitInstance[]>
  >(new Map());
  const [visitInstances, setVisitInstances] = useState<VisitInstance[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringVisitTemplate[]>([]);
  const [visitInstancesError, setVisitInstancesError] = useState("");
  const [isVisitInstancesLoading, setIsVisitInstancesLoading] = useState(true);
  const [hasVisitInstancesLoaded, setHasVisitInstancesLoaded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("auto");
  const [manualTemplateSelectionLock, setManualTemplateSelectionLock] = useState(false);

  const {
    startAddress,
    manualEndAddress,
    startGooglePlaceId,
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
  } = useRoutePlannerAddresses({ normalizedHomeAddress, hasAttemptedOptimize });

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
    handleCreateRecurringTemplateChange,
    handleAddCreateRecurringTemplate,
    handleRemoveCreateRecurringTemplate,
    handleCreatePatientAddressChange,
    handleCreatePatientAddressPick,
    handleCreatePatientSubmit,
  } = useCreatePatientForm({
    onPatientCreated: handleAddDestinationPatient,
  });

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
      selectedDestinations,
      destinationSearchPatients,
      isDestinationSearchLoading,
      locallyCreatedPatients,
      visitInstancesByPatientId,
      selectedDestinationIdSet,
      addDestinationPatient,
      setDestinationVisitIncluded,
      setDestinationPersistPlanningWindow,
    });

  useEffect(() => {
    setSelectedTemplateId("auto");
    setManualTemplateSelectionLock(false);
  }, [planningDate]);

  useEffect(() => {
    let isSubscribed = true;

    const loadVisitInstances = async () => {
      setVisitInstancesError("");
      setIsVisitInstancesLoading(true);
      try {
        await requestExpandVisitInstances({ planningDate });
        const [instances, templates] = await Promise.all([
          requestVisitInstances({ planningDate }),
          requestRecurringVisitTemplates(),
        ]);
        if (!isSubscribed) {
          return;
        }

        const nextInstancesByPatientId = new Map<string, VisitInstance[]>();
        instances.forEach((instance) => {
          const current = nextInstancesByPatientId.get(instance.patientId) ?? [];
          current.push(instance);
          nextInstancesByPatientId.set(instance.patientId, current);
        });
        setVisitInstances(instances);
        setVisitInstancesByPatientId(nextInstancesByPatientId);
        setRecurringTemplates(templates);
        setIsVisitInstancesLoading(false);
        setHasVisitInstancesLoaded(true);
      } catch (error) {
        if (!isSubscribed) {
          return;
        }
        setVisitInstances([]);
        setVisitInstancesByPatientId(new Map());
        setRecurringTemplates([]);
        setVisitInstancesError(
          error instanceof Error ? error.message : "Unable to load visit instances.",
        );
        setIsVisitInstancesLoading(false);
        setHasVisitInstancesLoaded(true);
      }
    };

    void loadVisitInstances();

    return () => {
      isSubscribed = false;
    };
  }, [planningDate]);

  const templateOptions = useMemo<TemplatePickerOption[]>(() => {
    const planningDayOfWeek = getPlanningDayOfWeek(planningDate);
    const scheduledCountsByTemplateId = new Map<string, number>();
    visitInstances
      .filter(
        (instance) =>
          instance.status === "scheduled" &&
          typeof instance.templateId === "string" &&
          instance.templateId.length > 0,
      )
      .forEach((instance) => {
        const templateId = instance.templateId as string;
        scheduledCountsByTemplateId.set(
          templateId,
          (scheduledCountsByTemplateId.get(templateId) ?? 0) + 1,
        );
      });

    return recurringTemplates
      .map((template) => {
        const displayName = template.name?.trim() || `Template ${template.id.slice(0, 8)}`;
        return {
          id: template.id,
          label: displayName,
          instanceCount: scheduledCountsByTemplateId.get(template.id) ?? 0,
          matchesPlanningDay: template.daysOfWeek.indexOf(planningDayOfWeek) !== -1,
        };
      })
      .sort((left, right) => {
        if (left.matchesPlanningDay !== right.matchesPlanningDay) {
          return left.matchesPlanningDay ? -1 : 1;
        }
        if (left.instanceCount !== right.instanceCount) {
          return right.instanceCount - left.instanceCount;
        }
        return left.label.localeCompare(right.label);
      });
  }, [planningDate, recurringTemplates, visitInstances]);

  const autoTemplateIds = useMemo(() => {
    const matchingOptions = templateOptions.filter((option) => option.matchesPlanningDay);
    if (matchingOptions.length === 0) {
      return null;
    }
    return new Set(matchingOptions.map((option) => option.id));
  }, [planningDate, templateOptions]);

  const effectiveTemplateIds = useMemo(() => {
    if (selectedTemplateId === "all") {
      return null;
    }
    if (selectedTemplateId === "auto") {
      return autoTemplateIds;
    }
    return new Set([selectedTemplateId]);
  }, [autoTemplateIds, selectedTemplateId]);

  const autoSeedTemplateLabel = useMemo(() => {
    if (!autoTemplateIds || autoTemplateIds.size === 0) {
      return "";
    }

    const names = [...autoTemplateIds].map((id) => {
      const option = templateOptions.find((o) => o.id === id);
      if (option) return option.label;
      const template = recurringTemplates.find((t) => t.id === id);
      if (template) return template.name?.trim() || `Template ${id.slice(0, 8)}`;
      return `Template ${id.slice(0, 8)}`;
    });

    return names.join(", ");
  }, [autoTemplateIds, recurringTemplates, templateOptions]);

  const autoSeedHint = useMemo(() => {
    if (
      manualTemplateSelectionLock ||
      selectedDestinations.length === 0 ||
      !autoTemplateIds ||
      autoTemplateIds.size === 0
    ) {
      return "";
    }
    const dayName = new Date(`${planningDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const count = autoTemplateIds.size;
    if (count === 1) {
      return `Scheduled for ${dayName} · ${autoSeedTemplateLabel}`;
    }
    return `Scheduled for ${dayName} · ${count} templates`;
  }, [
    manualTemplateSelectionLock,
    selectedDestinations.length,
    autoTemplateIds,
    planningDate,
    autoSeedTemplateLabel,
  ]);

  useEffect(() => {
    if (manualTemplateSelectionLock) {
      return;
    }
    if (destinationSearchQuery.trim().length > 0) {
      return;
    }

    const patientById = new Map(
      [...destinationSearchPatients, ...locallyCreatedPatients].map((patient) => [
        patient.id,
        patient,
      ]),
    );
    const knownTemplateIds = new Set(recurringTemplates.map((t) => t.id));
    const filteredInstances = (
      effectiveTemplateIds === null
        ? visitInstances
        : visitInstances.filter(
            (instance) =>
              instance.templateId !== null && effectiveTemplateIds.has(instance.templateId),
          )
    ).filter(
      (instance) => instance.templateId === null || knownTemplateIds.has(instance.templateId),
    );
    const instancesByPatientId = new Map<string, VisitInstance[]>();
    filteredInstances.forEach((instance) => {
      const current = instancesByPatientId.get(instance.patientId) ?? [];
      current.push(instance);
      instancesByPatientId.set(instance.patientId, current);
    });

    const nextDestinations = [...instancesByPatientId.entries()].flatMap(
      ([patientId, instances]) => {
        const patient = patientById.get(patientId);
        if (!patient) {
          return [];
        }
        return toSelectedVisitInstanceDestinations(patient, instances);
      },
    );

    const currentKeys = [...selectedDestinations.map((destination) => destination.visitKey)].sort();
    const nextKeys = [...nextDestinations.map((destination) => destination.visitKey)].sort();
    if (
      currentKeys.length === nextKeys.length &&
      currentKeys.every((visitKey, index) => visitKey === nextKeys[index])
    ) {
      return;
    }

    replaceSelectedDestinations(nextDestinations);
  }, [
    destinationSearchQuery,
    destinationSearchPatients,
    effectiveTemplateIds,
    locallyCreatedPatients,
    manualTemplateSelectionLock,
    recurringTemplates,
    replaceSelectedDestinations,
    selectedDestinations,
    visitInstances,
  ]);

  function handleAddDestinationPatient(patient: Parameters<typeof addDestinationPatient>[0]) {
    setManualTemplateSelectionLock(true);
    addDestinationPatient(patient, visitInstancesByPatientId.get(patient.id));
  }

  const handleRemoveDestinationVisit = (visitKey: string) => {
    setManualTemplateSelectionLock(true);
    removeDestinationVisit(visitKey);
  };

  const handleSetDestinationVisitIncluded = (visitKey: string, isIncluded: boolean) => {
    setManualTemplateSelectionLock(true);
    setDestinationVisitIncluded(visitKey, isIncluded);
  };

  const {
    plannerOptimizationObjective,
    setPlannerOptimizationObjective,
    localValidationError,
    hasChangedSinceLastOptimize,
    currentOptimizeSnapshot,
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

  useEffect(() => {
    if (result || isLoading) {
      return;
    }

    if (typeof restoreCachedResult === "function") {
      restoreCachedResult(currentOptimizeSnapshot);
    }
  }, [currentOptimizeSnapshot, isLoading, restoreCachedResult, result]);

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
    autoSeedHint,
    destinationSearchResults,
    destinationSearchQuery,
    onSearchQueryChange: setDestinationSearchQuery,
    isSearchLoading: isDestinationSearchLoading,
    isVisitInstancesLoading:
      isVisitInstancesLoading && !hasVisitInstancesLoaded && !manualTemplateSelectionLock,
    searchError: destinationSearchError || visitInstancesError || "",
    createPatientError: createPatientError ?? "",
    selectedDestinations,
    expandedDestinationVisitKeys,
    onAddPatient: handleAddDestinationPatient,
    onOpenCreatePatient: openCreatePatientModal,
    onToggleDestinationDetails: toggleDestinationDetails,
    onRemoveDestinationVisit: handleRemoveDestinationVisit,
    onSetDestinationVisitIncluded: handleSetDestinationVisitIncluded,
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
    onRecurringTemplateChange: handleCreateRecurringTemplateChange,
    onAddRecurringTemplate: handleAddCreateRecurringTemplate,
    onRemoveRecurringTemplate: handleRemoveCreateRecurringTemplate,
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
