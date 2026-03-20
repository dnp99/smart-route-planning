import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import { responsiveStyles } from "./responsiveStyles";
import type { Patient } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import { SelectedDestinationsSection } from "./routePlanner/SelectedDestinationsSection";
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
import { formatPatientNameFromParts } from "./patients/patientName";
import { PatientFormModal } from "./patients/PatientFormModal";
import {
  type MobilePlannerStep,
  readRoutePlannerDraft,
  persistRoutePlannerDraft,
} from "./routePlanner/routePlannerDraft";
import { OptimizedRouteResult } from "./routePlanner/OptimizedRouteResult";
import { useManualReorder } from "./routePlanner/useManualReorder";
import { useCreatePatientForm } from "./routePlanner/useCreatePatientForm";

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
  const [isDestinationListExpanded, setIsDestinationListExpanded] =
    useState(false);
  const [isPatientSearchExpanded, setIsPatientSearchExpanded] = useState(false);
  const [isTripSetupExpanded, setIsTripSetupExpanded] = useState(false);

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
      setIsDestinationListExpanded(false);
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
            <h1 className="m-0 text-xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Smart Route Planner
            </h1>
          </div>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
            Enter your starting point, ending point, and destination addresses.
            The planner prioritizes time-window feasibility first, then
            distance, with the ending point as the final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          {isMobileViewport && (
            <nav
              aria-label="Route planner steps"
              className={responsiveStyles.mobileStepNav}
            >
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
                    onClick={() =>
                      setActiveMobileStep(step.key as MobilePlannerStep)
                    }
                    className={`${responsiveStyles.mobileStepButton} ${
                      isActive
                        ? responsiveStyles.mobileStepButtonActive
                        : responsiveStyles.mobileStepButtonInactive
                    }`}
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
                          className="shrink-0 text-green-600 dark:text-green-400"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="text-[0.6rem] font-bold opacity-50">{step.stepNumber}</span>
                      )}
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {isTripStepVisible && !isTripSetupExpanded && !isMobileViewport && (
            <section className={responsiveStyles.panel}>
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <p className="m-0 min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
                  <span className="break-words">
                    {startAddress} <span className="text-slate-400">→</span>{" "}
                    {resolvedEndAddress}
                  </span>{" "}
                  —{" "}
                  <button
                    type="button"
                    onClick={() => setIsTripSetupExpanded(true)}
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    Edit
                  </button>
                </p>
                <button
                  type="button"
                  aria-label="Expand trip setup"
                  onClick={() => setIsTripSetupExpanded(true)}
                  className="text-slate-900 hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </section>
          )}

          {isTripStepVisible && (isTripSetupExpanded || isMobileViewport) && (
            <section className={responsiveStyles.panel}>
              <div className={responsiveStyles.cardHeader}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className={responsiveStyles.cardTitle}>Trip setup</h2>
                  {!isMobileViewport && startAddress.length > 0 && resolvedEndAddress.length > 0 && (
                    <button
                      type="button"
                      aria-label="Collapse trip setup"
                      onClick={() => setIsTripSetupExpanded(false)}
                      className="text-slate-900 hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className={responsiveStyles.cardDescription}>
                  Define where the nurse starts and how the route should end.
                </p>
              </div>

              {isHomeAddressMissing && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="m-0 text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Home address not set
                      </p>
                      <p className="m-0 text-xs text-amber-800 dark:text-amber-300">
                        Set your home address in Account settings to auto-fill
                        starting and ending points. You can still enter
                        addresses manually.
                      </p>
                    </div>
                    {onOpenAccountSettings && (
                      <button
                        type="button"
                        onClick={onOpenAccountSettings}
                        className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                      >
                        Open account settings
                      </button>
                    )}
                  </div>
                </div>
              )}

              <AddressAutocompleteInput
                id="startAddress"
                label="Starting point"
                placeholder="e.g. 1 Apple Park Way, Cupertino"
                value={startAddress}
                onChange={handleStartAddressChange}
                onSuggestionPick={handleStartAddressPick}
                onBlur={() => setStartTouched(true)}
                helperText="Type at least 3 characters to see suggestions."
                errorText={startFieldError}
                required
              />

              <AddressAutocompleteInput
                id="endAddress"
                label="Ending point"
                placeholder="e.g. Pearson International Airport"
                value={manualEndAddress}
                onChange={handleManualEndAddressChange}
                onSuggestionPick={handleManualEndAddressPick}
                onBlur={() => setEndTouched(true)}
                helperText="Type at least 3 characters to see suggestions."
                errorText={endFieldError}
                required
              />

            </section>
          )}

          {isPatientsStepVisible && !isPatientSearchExpanded && !isMobileViewport && (
            <section className={responsiveStyles.panel}>
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <p className="m-0 min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
                  {destinationCount === 0
                    ? "No patients selected"
                    : `${destinationCount} patient${destinationCount === 1 ? "" : "s"} selected`}{" "}
                  —{" "}
                  <button
                    type="button"
                    onClick={() => setIsPatientSearchExpanded(true)}
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    Edit
                  </button>
                </p>
                <button
                  type="button"
                  aria-label="Expand patient search"
                  onClick={() => setIsPatientSearchExpanded(true)}
                  className="text-slate-900 hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </section>
          )}

          {isPatientsStepVisible && (isPatientSearchExpanded || isMobileViewport) && (
            <section className={responsiveStyles.panel}>
              <div className={responsiveStyles.cardHeader}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className={responsiveStyles.cardTitle}>
                    Add patient(s) to create your schedule
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openCreatePatientModal}
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Add New Patient
                    </button>
                    {!isMobileViewport && selectedDestinations.length > 0 && (
                      <button
                        type="button"
                        aria-label="Collapse patient search"
                        onClick={() => setIsPatientSearchExpanded(false)}
                        className="text-slate-900 hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className={responsiveStyles.cardDescription}>
                  Add saved patients as route stops before optimizing the visit
                  order.
                </p>
              </div>
              {createPatientError && (
                <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                  {createPatientError}
                </p>
              )}
              <input
                id="destination-patient-search"
                type="search"
                aria-label="Destination patient search"
                value={destinationSearchQuery}
                onChange={(event) =>
                  setDestinationSearchQuery(event.target.value)
                }
                placeholder="Search saved patients by first or last name"
                className={responsiveStyles.searchInput}
              />

              {isDestinationSearchLoading && (
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                  Loading patients…
                </p>
              )}

              {destinationSearchError && (
                <p className="m-0 text-xs text-amber-700 dark:text-amber-300">
                  {destinationSearchError}
                </p>
              )}

              {destinationSearchResults.length > 0 && (
                <ul className={responsiveStyles.selectableList}>
                  {destinationSearchResults.map((patient) => {
                    const patientName = formatPatientNameFromParts(
                      patient.firstName,
                      patient.lastName,
                    );

                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => addDestinationPatient(patient)}
                          className={responsiveStyles.selectableItemButton}
                        >
                          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">
                            {patientName}
                          </p>
                          <p className="m-0 text-slate-600 dark:text-slate-300">
                            {patient.address}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {isPatientsStepVisible && isPatientSearchExpanded && !isDestinationListExpanded && selectedDestinations.length > 0 && !isMobileViewport ? (
            <section className={responsiveStyles.panel}>
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <p className="m-0 min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
                  {destinationCount} patient{destinationCount === 1 ? "" : "s"}{" "}
                  selected —{" "}
                  <button
                    type="button"
                    onClick={() => setIsDestinationListExpanded(true)}
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    Edit
                  </button>
                </p>
                <button
                  type="button"
                  aria-label="Expand selected patients"
                  onClick={() => setIsDestinationListExpanded(true)}
                  className="text-slate-900 hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </section>
          ) : (
            <SelectedDestinationsSection
              isVisible={isPatientsStepVisible && (isPatientSearchExpanded || isMobileViewport)}
              isMobileViewport={isMobileViewport}
              selectedDestinations={selectedDestinations}
              expandedDestinationVisitKeys={expandedDestinationVisitKeys}
              onToggleDestinationDetails={toggleDestinationDetails}
              onRemoveDestinationVisit={removeDestinationVisit}
              onSetDestinationVisitIncluded={setDestinationVisitIncluded}
              onUpdateDestinationPlanningWindow={
                updateDestinationPlanningWindow
              }
              onSetDestinationPersistPlanningWindow={
                setDestinationPersistPlanningWindow
              }
              onCollapse={() => setIsDestinationListExpanded(false)}
            />
          )}

          {isMobileViewport && activeMobileStep === "trip" && (
            <div className={responsiveStyles.stickyFooter}>
              {!hasValidTripAddresses && (
                <p className="m-0 mb-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  Add a starting and ending point to continue.
                </p>
              )}
              <button
                type="button"
                disabled={!hasValidTripAddresses}
                onClick={() => setActiveMobileStep("patients")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70"
              >
                Continue to Patients →
              </button>
            </div>
          )}

          {isMobileViewport && activeMobileStep === "patients" && (
            <div className={responsiveStyles.stickyFooter}>
              {selectedDestinations.length === 0 && (
                <p className="m-0 mb-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  Add at least one patient to continue.
                </p>
              )}
              <button
                type="button"
                disabled={selectedDestinations.length === 0}
                onClick={() => setActiveMobileStep("review")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70"
              >
                Continue to Review →
              </button>
            </div>
          )}

          {isReviewStepVisible && isMobileViewport && (
            <section className={responsiveStyles.mobileReviewCard}>
              <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">
                Ready to optimize
              </p>
              <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                {destinationCount} destination(s) included
                {resolvedEndAddress.trim().length === 0
                  ? " • ending point missing"
                  : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMobileStep("trip")}
                  className={responsiveStyles.secondaryButton}
                >
                  Edit trip
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileStep("patients")}
                  className={responsiveStyles.secondaryButton}
                >
                  Edit patients
                </button>
              </div>
            </section>
          )}

          {isReviewStepVisible && (
            <div
              className={`${responsiveStyles.footerRow} ${
                isMobileViewport ? responsiveStyles.stickyFooter : ""
              }`}
            >
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-300">
                {destinationCount} visit(s) detected
              </span>
              <button
                type="submit"
                disabled={isLoading || !canOptimize || (!!result && !hasChangedSinceLastOptimize)}
                className="optimize-route-button inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70 sm:w-auto"
                data-loading={isLoading ? "true" : "false"}
                data-success={showOptimizeSuccess ? "true" : "false"}
              >
                {isLoading && (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
                    aria-hidden="true"
                  />
                )}
                {isLoading
                  ? "Optimizing..."
                  : result
                    ? "Re-optimize Route"
                    : "Optimize Route"}
              </button>
            </div>
          )}
        </form>

        {optimizeEndpointHint && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
            {optimizeEndpointHint}
          </p>
        )}

        {localValidationError && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
            {localValidationError}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <OptimizedRouteResult
            result={result}
            orderedStops={manuallyOrderedStops}
            routeLegs={result.routeLegs}
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
              setExpandedResultTaskIds((current) => ({
                ...current,
                [taskId]: !current[taskId],
              }))
            }
            expandedResultEndingStopIds={expandedResultEndingStopIds}
            onToggleResultEndingStop={(stopId) =>
              setExpandedResultEndingStopIds((current) => ({
                ...current,
                [stopId]: !current[stopId],
              }))
            }
            normalizedHomeAddress={normalizedHomeAddress}
          />
        )}
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
