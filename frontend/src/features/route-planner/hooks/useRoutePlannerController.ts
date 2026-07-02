import { useEffect, useMemo, useRef, useState } from "react";

const DAY_ABBRS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const templateDisplayName = (template: RecurringVisitTemplate): string => {
  if (template.name?.trim()) return template.name.trim();
  if (template.daysOfWeek.length === 7) return "Daily";
  if (template.daysOfWeek.length > 0) {
    return `Weekly · ${template.daysOfWeek.map((d) => DAY_ABBRS[d]).join(", ")}`;
  }
  return "Unnamed template";
};
import type {
  RecurringVisitTemplate,
  VisitInstance,
  WeeklyWorkingHours,
} from "../../../../../shared/contracts";
import { parseOptimizeRouteV2Response } from "../../../../../shared/contracts";
import { fetchRouteRunById } from "../../../components/home/homeDashboardService";
import { usePatientSearch } from "./usePatientSearch";
import { useRouteOptimization } from "./useRouteOptimization";
import { useRouteAdvisor } from "./useRouteAdvisor";
import {
  requestExpandVisitInstances,
  requestRecurringVisitTemplates,
  requestUpdateVisitInstance,
  requestVisitInstances,
  resolveWorkingHoursForDate,
} from "../api/routePlannerService";
import {
  buildSelectedDestinationsFromResult,
  patientMatchesSearchQuery,
  toSelectedVisitInstanceDestinations,
} from "../domain/routePlannerHelpers";
import { readRoutePlannerDraft } from "../state/routePlannerDraft";
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

const todayPlanningDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type UseRoutePlannerControllerParams = {
  nurseHomeAddress?: string | null;
  nurseWorkingHours?: WeeklyWorkingHours | null;
  nurseBreakGapThresholdMinutes?: number | null;
  onOpenAccountSettings?: () => void;
  optimizationObjective: "time" | "distance";
  autoOptimizeToday?: boolean;
  savedRouteRunId?: string | null;
  savedRouteRunPlanningDate?: string | null;
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
  autoOptimizeToday = false,
  savedRouteRunId = null,
  savedRouteRunPlanningDate = null,
}: UseRoutePlannerControllerParams) {
  const pendingAutoOptimizeRef = useRef(autoOptimizeToday);
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
    loadSavedResult,
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
  const [activeVisitInstanceActionId, setActiveVisitInstanceActionId] = useState<string | null>(
    null,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("auto");
  const [manualTemplateSelectionLock, setManualTemplateSelectionLock] = useState(false);

  const toInstancesByPatientId = (instances: VisitInstance[]) => {
    const nextInstancesByPatientId = new Map<string, VisitInstance[]>();
    instances.forEach((instance) => {
      const current = nextInstancesByPatientId.get(instance.patientId) ?? [];
      current.push(instance);
      nextInstancesByPatientId.set(instance.patientId, current);
    });
    return nextInstancesByPatientId;
  };

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

    // Keep already-selected patients in the list (shown with an "In route"
    // badge) rather than removing them, matching the redesigned client list.
    return [...byId.values()].filter((patient) =>
      patientMatchesSearchQuery(patient, destinationSearchQuery),
    );
  }, [destinationSearchPatients, destinationSearchQuery, locallyCreatedPatients]);

  const { planningDate, setPlanningDate, isMobileViewport } = useRoutePlannerDraftState({
    initialDraft,
    resolveDefaultPlanningDate: autoOptimizeToday ? todayPlanningDate : defaultPlanningDate,
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
    if (!savedRouteRunId) return;

    let isSubscribed = true;

    const loadRun = async () => {
      try {
        const run = await fetchRouteRunById(savedRouteRunId);

        if (!isSubscribed) return;

        if (savedRouteRunPlanningDate) {
          setPlanningDate(savedRouteRunPlanningDate);
        }

        const parsedResult = parseOptimizeRouteV2Response(run.resultPayload);
        if (!parsedResult) return;

        const requestVisits: Array<{
          visitId: string;
          patientName?: string;
          address?: string;
          windowStart?: string;
          windowEnd?: string;
          windowType?: "fixed" | "flexible";
        }> = Array.isArray((run.requestPayload as Record<string, unknown> | null)?.visits)
          ? ((run.requestPayload as Record<string, unknown>).visits as typeof requestVisits)
          : [];

        const visitById = new Map(requestVisits.map((v) => [v.visitId, v]));

        const unscheduledTasks = parsedResult.unscheduledTasks.map((task) => {
          const source = visitById.get(task.visitId);
          if (!source) return task;
          return {
            ...task,
            patientName: source.patientName,
            address: source.address,
            windowStart: source.windowStart,
            windowEnd: source.windowEnd,
            windowType: source.windowType,
          };
        });

        loadSavedResult({ ...parsedResult, unscheduledTasks });
      } catch {
        // silently ignore — UI already shows empty state
      }
    };

    void loadRun();

    return () => {
      isSubscribed = false;
    };
  }, [savedRouteRunId, savedRouteRunPlanningDate, setPlanningDate, loadSavedResult]);

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

        const nextInstancesByPatientId = toInstancesByPatientId(instances);
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
        const displayName = templateDisplayName(template);
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
      if (template) return templateDisplayName(template);
      return "Unnamed template";
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
    return `Scheduled for ${dayName} · ${count} templates · (auto seeded)`;
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
      (instance) => instance.templateId !== null && knownTemplateIds.has(instance.templateId),
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

  // Keep "Your Route" consistent with the route being shown. Whenever a result
  // is displayed (restored from the session/runtime cache, a saved run, or an
  // optimize) and the user hasn't manually curated the selection, reconcile the
  // selection to the result's visits — so it can't drift empty (e.g. after a
  // planning-date change wipes the auto-seed while the result still shows).
  // Runs after the auto-seed effect so it wins the same commit; taking the
  // manual lock stops auto-seed from re-wiping and guards the user's later edits.
  useEffect(() => {
    if (!result || manualTemplateSelectionLock) {
      return;
    }

    const restored = buildSelectedDestinationsFromResult(result);
    if (restored.length === 0) {
      return;
    }

    // Own the selection so auto-seed leaves it alone; only rebuild if it doesn't
    // already cover the result's clients (avoids clobbering a matching selection).
    setManualTemplateSelectionLock(true);

    const resultPatientIds = new Set(restored.map((destination) => destination.patientId));
    const selectionPatientIds = new Set(
      selectedDestinations.map((destination) => destination.patientId),
    );
    const alreadyMatches =
      resultPatientIds.size === selectionPatientIds.size &&
      [...resultPatientIds].every((patientId) => selectionPatientIds.has(patientId));
    if (!alreadyMatches) {
      replaceSelectedDestinations(restored);
    }
  }, [result, manualTemplateSelectionLock, selectedDestinations, replaceSelectedDestinations]);

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

  const handleVisitInstancePatched = (updatedInstance: VisitInstance) => {
    const nextVisitInstances = visitInstances.flatMap((instance) => {
      if (instance.id !== updatedInstance.id) {
        return [instance];
      }

      if (updatedInstance.planningDate !== planningDate) {
        return [];
      }

      return [updatedInstance];
    });

    setVisitInstances(nextVisitInstances);
    setVisitInstancesByPatientId(toInstancesByPatientId(nextVisitInstances));

    const nextSelectedDestinations = selectedDestinations.flatMap((destination) => {
      if (destination.visitId !== updatedInstance.id) {
        return [destination];
      }

      if (updatedInstance.planningDate !== planningDate) {
        return [];
      }

      return [
        {
          ...destination,
          planningDate: updatedInstance.planningDate,
          originalPlanningDate: updatedInstance.planningDate,
          windowStart: updatedInstance.windowStart.slice(0, 5),
          originalWindowStart: updatedInstance.windowStart.slice(0, 5),
          windowEnd: updatedInstance.windowEnd.slice(0, 5),
          originalWindowEnd: updatedInstance.windowEnd.slice(0, 5),
          windowType: updatedInstance.visitTimeType,
          serviceDurationMinutes: updatedInstance.serviceDurationMinutes,
          visitStatus: updatedInstance.status,
          isIncluded: updatedInstance.status === "scheduled",
        },
      ];
    });

    replaceSelectedDestinations(nextSelectedDestinations);
  };

  const handleVisitInstanceStatusChange = async (
    visitId: string,
    status: "scheduled" | "cancelled",
  ) => {
    setActiveVisitInstanceActionId(visitId);
    setVisitInstancesError("");

    try {
      const updated = await requestUpdateVisitInstance(visitId, { status });
      setManualTemplateSelectionLock(true);
      handleVisitInstancePatched(updated);
    } catch (error) {
      setVisitInstancesError(
        error instanceof Error ? error.message : "Unable to update visit occurrence.",
      );
    } finally {
      setActiveVisitInstanceActionId(null);
    }
  };

  const handleVisitInstanceReschedule = async (
    visitId: string,
    updates: { planningDate?: string; windowStart?: string; windowEnd?: string },
  ) => {
    const normalizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => typeof value === "string" && value.length > 0),
    ) as { planningDate?: string; windowStart?: string; windowEnd?: string };

    if (Object.keys(normalizedUpdates).length === 0) {
      return;
    }

    setActiveVisitInstanceActionId(visitId);
    setVisitInstancesError("");

    try {
      const updated = await requestUpdateVisitInstance(visitId, normalizedUpdates);
      setManualTemplateSelectionLock(true);
      handleVisitInstancePatched(updated);
    } catch (error) {
      setVisitInstancesError(
        error instanceof Error ? error.message : "Unable to update visit occurrence.",
      );
    } finally {
      setActiveVisitInstanceActionId(null);
    }
  };

  const handleClearSelectedDestinations = () => {
    setManualTemplateSelectionLock(true);
    replaceSelectedDestinations([]);
  };

  const {
    plannerOptimizationObjective,
    setPlannerOptimizationObjective,
    localValidationError,
    hasChangedSinceLastOptimize,
    currentOptimizeSnapshot,
    unscheduledResubmitCount,
    handleSubmit,
    triggerOptimize,
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

  // Auto-optimize effect: fires once when "Plan my day" navigates here.
  // Waits until instances are loaded, destinations are seeded from templates,
  // and the home address is valid — then triggers optimization automatically.
  useEffect(() => {
    if (!pendingAutoOptimizeRef.current) return;
    if (!hasVisitInstancesLoaded) return;
    if (selectedDestinations.length === 0) return;
    if (!canOptimize) return;
    if (result || isLoading) return;

    pendingAutoOptimizeRef.current = false;
    void triggerOptimize();
  }, [
    hasVisitInstancesLoaded,
    selectedDestinations.length,
    canOptimize,
    result,
    isLoading,
    triggerOptimize,
  ]);

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

  const { advice, isLoadingAdvice, adviceError, adviceUnavailable, requestAdvice } =
    useRouteAdvisor(result);

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

  // Mobile is a single scrollable column (no step-wizard) — all sections always render.
  const isTripStepVisible = true;
  const isPatientsStepVisible = true;

  const tripSetupSectionProps = {
    isVisible: isTripStepVisible,
    isMobileViewport,
    isExpanded: isTripSetupExpanded,
    onSetExpanded: setIsTripSetupExpanded,
    stopCount: destinationCount,
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
    startAddress,
    resolvedEndAddress,
    planningDate,
    createPatientError: createPatientError ?? "",
    selectedDestinations,
    expandedDestinationVisitKeys,
    onAddPatient: handleAddDestinationPatient,
    onOpenCreatePatient: openCreatePatientModal,
    onToggleDestinationDetails: toggleDestinationDetails,
    onClearSelectedDestinations: handleClearSelectedDestinations,
    onRemoveDestinationVisit: handleRemoveDestinationVisit,
    onSetDestinationVisitIncluded: handleSetDestinationVisitIncluded,
    onUpdateDestinationPlanningWindow: updateDestinationPlanningWindow,
    onSetDestinationPersistPlanningWindow: setDestinationPersistPlanningWindow,
    activeVisitInstanceActionId,
    onVisitInstanceStatusChange: handleVisitInstanceStatusChange,
    onVisitInstanceReschedule: handleVisitInstanceReschedule,
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
    advice,
    isLoadingAdvice,
    adviceError,
    adviceUnavailable,
    onRequestAdvice: result ? () => requestAdvice(result, planningDate) : undefined,
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
    // True while a v3 optimize is in flight — used to lock trip-setup inputs so
    // they can't drift out of sync with the request that's already been sent.
    isOptimizing: isLoading,
    tripSetupSectionProps,
    patientSelectorSectionProps,
    routeResultSectionProps,
    patientFormModalProps,
  };
}
