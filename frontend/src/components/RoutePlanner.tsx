import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import { responsiveStyles } from "./responsiveStyles";
import type { Patient, VisitTimeType } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import { SelectedDestinationsSection } from "./routePlanner/SelectedDestinationsSection";
import type { SelectedPatientDestination } from "./routePlanner/routePlannerTypes";
import type { AddressSuggestion } from "./types";
import { formatNameWords, formatPatientNameFromParts } from "./patients/patientName";
import { PatientFormModal } from "./patients/PatientFormModal";
import {
  EMPTY_FORM,
  createEmptyVisitWindow,
  type FormFieldErrors,
  type PatientFormValues,
  type PatientFormVisitWindow,
  toCreateRequest,
  validateForm,
} from "./patients/patientForm";
import { createPatient } from "./patients/patientService";
import {
  type MobilePlannerStep,
  readRoutePlannerDraft,
  persistRoutePlannerDraft,
} from "./routePlanner/routePlannerDraft";
import { timeToMinutes } from "./routePlanner/routePlannerResultUtils";
import { OptimizedRouteResult } from "./routePlanner/OptimizedRouteResult";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const DEFAULT_START_ADDRESS = "3361 Ingram Road, Mississauga, ON";

const toWindowTime = (value: string) => value.slice(0, 5);
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const hasCompleteWindow = (destination: SelectedPatientDestination) =>
  HH_MM_PATTERN.test(destination.windowStart) && HH_MM_PATTERN.test(destination.windowEnd);

const hasAnyWindowBoundary = (destination: SelectedPatientDestination) =>
  destination.windowStart.trim().length > 0 || destination.windowEnd.trim().length > 0;

const toSelectedPatientDestinations = (
  patient: Patient,
): SelectedPatientDestination[] => {
  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);
  const patientVisitWindows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
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

const formatPatientListLabel = (destinations: SelectedPatientDestination[]) => {
  const names = [...new Set(
    destinations
      .map((destination) => formatNameWords(destination.patientName))
      .filter((name) => name.length > 0),
  )];

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

const patientMatchesSearchQuery = (patient: Patient, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName).toLowerCase();
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const [activeMobileStep, setActiveMobileStep] =
    useState<MobilePlannerStep>(initialDraft?.activeMobileStep ?? "trip");
  const [startAddress, setStartAddress] = useState(
    initialDraft?.startAddress ??
      (normalizedHomeAddress.length > 0 ? normalizedHomeAddress : DEFAULT_START_ADDRESS),
  );
  const [manualEndAddress, setManualEndAddress] = useState(
    initialDraft?.manualEndAddress ?? normalizedHomeAddress,
  );
  const [startGooglePlaceId, setStartGooglePlaceId] = useState<string | null>(
    initialDraft?.startGooglePlaceId ?? null,
  );
  const [manualEndGooglePlaceId, setManualEndGooglePlaceId] = useState<string | null>(
    initialDraft?.manualEndGooglePlaceId ?? null,
  );

  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [locallyCreatedPatients, setLocallyCreatedPatients] = useState<Patient[]>([]);
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] = useState(false);
  const [createPatientFormValues, setCreatePatientFormValues] =
    useState<PatientFormValues>(EMPTY_FORM);
  const [createPatientFormErrors, setCreatePatientFormErrors] = useState<FormFieldErrors>({});
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [createPatientError, setCreatePatientError] = useState("");
  const [localValidationError, setLocalValidationError] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<
    SelectedPatientDestination[]
  >(initialDraft?.selectedDestinations ?? []);
  const [expandedDestinationVisitKeys, setExpandedDestinationVisitKeys] =
    useState<Record<string, boolean>>({});
  const [expandedResultTaskIds, setExpandedResultTaskIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedResultEndingStopIds, setExpandedResultEndingStopIds] = useState<
    Record<string, boolean>
  >({});
  const [conflictWarningsDismissed, setConflictWarningsDismissed] = useState(false);
  const [latenessWarningsDismissed, setLatenessWarningsDismissed] = useState(false);
  const [isDestinationListExpanded, setIsDestinationListExpanded] = useState(true);
  const selectedCreateVisitType =
    createPatientFormValues.visitWindows[0]?.visitTimeType ?? "flexible";

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
    showOptimizeSuccess,
    hasAttemptedOptimize,
    optimizeRoute,
  } = useRouteOptimization();

  useEffect(() => {
    if (result) {
      setIsDestinationListExpanded(false);
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
    if (initialDraft) {
      return;
    }

    if (normalizedHomeAddress.length === 0) {
      return;
    }

    if (startAddress.trim().length === 0 || startAddress === DEFAULT_START_ADDRESS) {
      setStartAddress(normalizedHomeAddress);
      setStartGooglePlaceId(null);
    }

    if (manualEndAddress.trim().length === 0) {
      setManualEndAddress(normalizedHomeAddress);
      setManualEndGooglePlaceId(null);
    }
  }, [
    initialDraft,
    manualEndAddress,
    normalizedHomeAddress,
    startAddress,
  ]);

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

      if (!changed && Object.keys(current).length !== selectedDestinations.length) {
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
    () => new Set(selectedDestinations.map((destination) => destination.patientId)),
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

  const resetCreatePatientFormState = () => {
    setCreatePatientFormValues(EMPTY_FORM);
    setCreatePatientFormErrors({});
    setCreatePatientError("");
  };

  const openCreatePatientModal = () => {
    resetCreatePatientFormState();
    setIsCreatePatientModalOpen(true);
  };

  const closeCreatePatientModal = () => {
    if (isCreatingPatient) {
      return;
    }

    setIsCreatePatientModalOpen(false);
    resetCreatePatientFormState();
  };

  const handleCreatePatientFieldChange = <K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K],
  ) => {
    setCreatePatientFormValues((current) => ({ ...current, [field]: value }));
    setCreatePatientFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCreatePatientVisitWindowChange = <K extends keyof PatientFormVisitWindow>(
    windowId: string,
    field: K,
    value: PatientFormVisitWindow[K],
  ) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.map((window) =>
        window.id === windowId ? { ...window, [field]: value } : window,
      ),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleAddCreatePatientVisitWindow = () => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: [
        ...current.visitWindows,
        createEmptyVisitWindow(
          current.visitWindows[0]?.visitTimeType ?? "flexible",
          current.visitWindows.length,
        ),
      ],
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleRemoveCreatePatientVisitWindow = (windowId: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      visitWindows: current.visitWindows.filter((window) => window.id !== windowId),
    }));
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleCreatePatientVisitTypeChange = (visitTimeType: VisitTimeType) => {
    setCreatePatientFormValues((current) => {
      if (visitTimeType === "flexible") {
        return {
          ...current,
          visitWindows: [],
        };
      }

      if (current.visitWindows.length === 0) {
        return {
          ...current,
          visitWindows: [createEmptyVisitWindow("fixed", 0)],
        };
      }

      return {
        ...current,
        visitWindows: current.visitWindows.map((window) => ({
          ...window,
          visitTimeType,
        })),
      };
    });
    setCreatePatientFormErrors((current) => ({
      ...current,
      visitWindows: undefined,
      visitWindowRows: undefined,
    }));
  };

  const handleCreatePatientAddressChange = (value: string) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      address: value,
      googlePlaceId: null,
    }));
    setCreatePatientFormErrors((current) => ({ ...current, address: undefined }));
  };

  const handleCreatePatientAddressPick = (suggestion: AddressSuggestion) => {
    setCreatePatientFormValues((current) => ({
      ...current,
      address: suggestion.displayName,
      googlePlaceId: suggestion.placeId,
    }));
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

  const setDestinationVisitIncluded = (visitKey: string, isIncluded: boolean) => {
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

    const fixedDestinationsMissingWindow = requestDestinations.filter(
      (destination) => destination.windowType === "fixed" && !hasCompleteWindow(destination),
    );
    if (fixedDestinationsMissingWindow.length > 0) {
      setLocalValidationError(
        `Set start and end time before optimizing for fixed visits: ${formatPatientListLabel(fixedDestinationsMissingWindow)}.`,
      );
      return;
    }

    const flexibleDestinationsWithPartialWindow = requestDestinations.filter(
      (destination) =>
        destination.windowType === "flexible" &&
        hasAnyWindowBoundary(destination) &&
        !hasCompleteWindow(destination),
    );
    if (flexibleDestinationsWithPartialWindow.length > 0) {
      setLocalValidationError(
        `Set both start and end time (or clear both) before optimizing for: ${formatPatientListLabel(flexibleDestinationsWithPartialWindow)}.`,
      );
      return;
    }

    const destinationsWithInvalidWindowOrder = requestDestinations.filter(
      (destination) =>
        hasCompleteWindow(destination) &&
        timeToMinutes(destination.windowEnd) <= timeToMinutes(destination.windowStart),
    );
    if (destinationsWithInvalidWindowOrder.length > 0) {
      setLocalValidationError(
        `Visit end time must be later than start time for: ${formatPatientListLabel(destinationsWithInvalidWindowOrder)}.`,
      );
      return;
    }

    const destinationsMissingPersistWindow = requestDestinations.filter(
      (destination) => destination.persistPlanningWindow && !hasCompleteWindow(destination),
    );
    if (destinationsMissingPersistWindow.length > 0) {
      setLocalValidationError(
        `Set start and end time before saving to patient record for: ${formatPatientListLabel(destinationsMissingPersistWindow)}.`,
      );
      return;
    }

    const optimizeDestinations = requestDestinations.map(
      ({
        visitKey: _visitKey,
        sourceWindowId: _sourceWindowId,
        requiresPlanningWindow: _requiresPlanningWindow,
        isIncluded: _isIncluded,
        persistPlanningWindow: _persistPlanningWindow,
        ...destination
      }) =>
        destination,
    );

    const planningWindowsToPersist = requestDestinations
      .filter((destination) => destination.persistPlanningWindow && hasCompleteWindow(destination))
      .map((destination) => ({
        patientId: destination.patientId,
        sourceWindowId: destination.sourceWindowId,
        startTime: destination.windowStart,
        endTime: destination.windowEnd,
        visitTimeType: destination.windowType,
      }));

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

    await optimizeRoute({
      startAddress,
      ...(startGooglePlaceId ? { startGooglePlaceId } : {}),
      endAddress: resolvedEndAddress,
      ...(resolvedEndGooglePlaceId ? { endGooglePlaceId: resolvedEndGooglePlaceId } : {}),
      destinations: optimizeDestinations,
      canOptimize,
    });
  };

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

  const handleCreatePatientSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePatientError("");

    const nextErrors = validateForm(createPatientFormValues);
    setCreatePatientFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsCreatingPatient(true);
    try {
      const createdPatient = await createPatient(toCreateRequest(createPatientFormValues));

      setLocallyCreatedPatients((current) => {
        const next = current.filter((patient) => patient.id !== createdPatient.id);
        return [createdPatient, ...next];
      });
      addDestinationPatient(createdPatient);
      setIsCreatePatientModalOpen(false);
      resetCreatePatientFormState();
    } catch (error) {
      setCreatePatientError(error instanceof Error ? error.message : "Unable to create patient.");
    } finally {
      setIsCreatingPatient(false);
    }
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
  const isPatientsStepVisible = !isMobileViewport || activeMobileStep === "patients";
  const isReviewStepVisible = !isMobileViewport || activeMobileStep === "review";

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
            Enter your starting point, ending point, and destination
            addresses. The planner prioritizes time-window feasibility first,
            then distance, with the ending point as the final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          {isMobileViewport && (
            <nav
              aria-label="Route planner steps"
              className={responsiveStyles.mobileStepNav}
            >
              {[
                { key: "trip", label: "Trip" },
                { key: "patients", label: "Patients" },
                { key: "review", label: "Review" },
              ].map((step) => {
                const isActive = activeMobileStep === step.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveMobileStep(step.key as MobilePlannerStep)}
                    className={`${responsiveStyles.mobileStepButton} ${
                      isActive
                        ? responsiveStyles.mobileStepButtonActive
                        : responsiveStyles.mobileStepButtonInactive
                    }`}
                  >
                    {step.label}
                  </button>
                );
              })}
            </nav>
          )}

          {isTripStepVisible && (
            <section className={responsiveStyles.panel}>
              <div className={responsiveStyles.cardHeader}>
                <h2 className={responsiveStyles.cardTitle}>Trip setup</h2>
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
                        Set your home address in Account settings to auto-fill starting and ending
                        points. You can still enter addresses manually.
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

              {isMobileViewport && (
                <button
                  type="button"
                  onClick={() => setActiveMobileStep("patients")}
                  className={responsiveStyles.secondaryButton}
                >
                  Continue to Patients
                </button>
              )}
            </section>
          )}

          {isPatientsStepVisible && (
            <section className={responsiveStyles.panel}>
            <div className={responsiveStyles.cardHeader}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className={responsiveStyles.cardTitle}>
                  Destination patient search
                </h2>
                <button
                  type="button"
                  onClick={openCreatePatientModal}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add New Patient
                </button>
              </div>
              <p className={responsiveStyles.cardDescription}>
                Add saved patients as route stops before optimizing the visit order.
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
              onChange={(event) => setDestinationSearchQuery(event.target.value)}
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
                  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);

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

          {isPatientsStepVisible && result && !isDestinationListExpanded ? (
            <section className={responsiveStyles.panel}>
              <p className="m-0 text-sm text-slate-700 dark:text-slate-300">
                {destinationCount} patient{destinationCount === 1 ? "" : "s"} selected —{" "}
                <button
                  type="button"
                  onClick={() => setIsDestinationListExpanded(true)}
                  className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                >
                  Edit
                </button>
              </p>
            </section>
          ) : (
            <SelectedDestinationsSection
              isVisible={isPatientsStepVisible}
              isMobileViewport={isMobileViewport}
              selectedDestinations={selectedDestinations}
              expandedDestinationVisitKeys={expandedDestinationVisitKeys}
              onToggleDestinationDetails={toggleDestinationDetails}
              onRemoveDestinationVisit={removeDestinationVisit}
              onSetDestinationVisitIncluded={setDestinationVisitIncluded}
              onUpdateDestinationPlanningWindow={updateDestinationPlanningWindow}
              onSetDestinationPersistPlanningWindow={setDestinationPersistPlanningWindow}
              onContinueToReview={() => setActiveMobileStep("review")}
            />
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
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 shadow-sm dark:border-amber-900/70 dark:bg-slate-900 dark:text-amber-300">
                {destinationCount} destination(s) detected
              </span>
              <button
                type="submit"
                disabled={isLoading || !canOptimize}
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
                {isLoading ? "Optimizing..." : result ? "Re-optimize Route" : "Optimize Route"}
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
            conflictWarningsDismissed={conflictWarningsDismissed}
            onDismissConflictWarnings={() => setConflictWarningsDismissed(true)}
            latenessWarningsDismissed={latenessWarningsDismissed}
            onDismissLatenessWarnings={() => setLatenessWarningsDismissed(true)}
            expandedResultTaskIds={expandedResultTaskIds}
            onToggleResultTask={(taskId) => setExpandedResultTaskIds((current) => ({ ...current, [taskId]: !current[taskId] }))}
            expandedResultEndingStopIds={expandedResultEndingStopIds}
            onToggleResultEndingStop={(stopId) => setExpandedResultEndingStopIds((current) => ({ ...current, [stopId]: !current[stopId] }))}
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
