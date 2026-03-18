import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import type { Patient, VisitTimeType } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlanner/routePlannerUtils";
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

type MobilePlannerStep = "trip" | "patients" | "review";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const ROUTE_PLANNER_DRAFT_STORAGE_KEY = "careflow.route-planner.draft.v1";
const DEFAULT_START_ADDRESS = "3361 Ingram Road, Mississauga, ON";

type RoutePlannerDraft = {
  version: 1;
  startAddress: string;
  manualEndAddress: string;
  startGooglePlaceId: string | null;
  manualEndGooglePlaceId: string | null;
  activeMobileStep: MobilePlannerStep;
  selectedDestinations: SelectedPatientDestination[];
};

const toWindowTime = (value: string) => value.slice(0, 5);
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

const normalizeAddressForComparison = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const addressesMatch = (leftAddress: string, rightAddress: string) => {
  const normalizedLeft = normalizeAddressForComparison(leftAddress);
  const normalizedRight = normalizeAddressForComparison(rightAddress);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
};

const hasCompleteWindow = (destination: SelectedPatientDestination) =>
  HH_MM_PATTERN.test(destination.windowStart) && HH_MM_PATTERN.test(destination.windowEnd);

const hasAnyWindowBoundary = (destination: SelectedPatientDestination) =>
  destination.windowStart.trim().length > 0 || destination.windowEnd.trim().length > 0;

const windowsOverlap = (
  left: Pick<SelectedPatientDestination, "windowStart" | "windowEnd">,
  right: Pick<SelectedPatientDestination, "windowStart" | "windowEnd">,
) =>
  timeToMinutes(left.windowStart) < timeToMinutes(right.windowEnd) &&
  timeToMinutes(right.windowStart) < timeToMinutes(left.windowEnd);

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

const unscheduledReasonLabels = {
  fixed_window_unreachable: "Cannot be reached before the fixed window ends.",
  invalid_window: "The visit window is invalid.",
  duration_exceeds_window: "Service duration is longer than the window.",
  insufficient_day_capacity: "Not enough day capacity for this visit.",
} as const;

const formatVisitDurationMinutes = (minutes: number) => {
  if (
    typeof minutes !== "number" ||
    minutes !== minutes ||
    minutes === Infinity ||
    minutes === -Infinity ||
    minutes <= 0
  ) {
    return "";
  }

  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const remainingMinutes = wholeMinutes % 60;

  if (hours === 0) {
    return `${wholeMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hr" : `${hours} hrs`;
  }

  const hourLabel = hours === 1 ? "1 hr" : `${hours} hrs`;
  return `${hourLabel} ${remainingMinutes} min`;
};

const expectedStartTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const formatExpectedStartTimeText = (serviceStartTime: string) => {
  const parsedDate = new Date(serviceStartTime);
  const parsedTimeMs = parsedDate.getTime();
  if (parsedTimeMs !== parsedTimeMs) {
    return "";
  }

  return `Expected start time ${expectedStartTimeFormatter.format(parsedDate)}`;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWindowType = (value: unknown): value is "fixed" | "flexible" =>
  value === "fixed" || value === "flexible";

const isMobilePlannerStep = (value: unknown): value is MobilePlannerStep =>
  value === "trip" || value === "patients" || value === "review";

const parseSelectedPatientDestination = (
  value: unknown,
): SelectedPatientDestination | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.visitKey !== "string" ||
    (value.sourceWindowId !== null && typeof value.sourceWindowId !== "string") ||
    typeof value.patientId !== "string" ||
    typeof value.patientName !== "string" ||
    typeof value.address !== "string" ||
    (value.googlePlaceId !== null && typeof value.googlePlaceId !== "string") ||
    typeof value.windowStart !== "string" ||
    typeof value.windowEnd !== "string" ||
    !isWindowType(value.windowType) ||
    typeof value.serviceDurationMinutes !== "number" ||
    value.serviceDurationMinutes !== value.serviceDurationMinutes ||
    value.serviceDurationMinutes === Infinity ||
    value.serviceDurationMinutes === -Infinity ||
    typeof value.requiresPlanningWindow !== "boolean" ||
    typeof value.isIncluded !== "boolean" ||
    typeof value.persistPlanningWindow !== "boolean"
  ) {
    return null;
  }

  return {
    visitKey: value.visitKey,
    sourceWindowId: value.sourceWindowId,
    patientId: value.patientId,
    patientName: value.patientName,
    address: value.address,
    googlePlaceId: value.googlePlaceId,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    windowType: value.windowType,
    serviceDurationMinutes: value.serviceDurationMinutes,
    requiresPlanningWindow: value.requiresPlanningWindow,
    isIncluded: value.isIncluded,
    persistPlanningWindow: value.persistPlanningWindow,
  };
};

const readRoutePlannerDraft = (): RoutePlannerDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    if (
      typeof parsed.startAddress !== "string" ||
      typeof parsed.manualEndAddress !== "string" ||
      (parsed.startGooglePlaceId !== null &&
        typeof parsed.startGooglePlaceId !== "string") ||
      (parsed.manualEndGooglePlaceId !== null &&
        typeof parsed.manualEndGooglePlaceId !== "string") ||
      !isMobilePlannerStep(parsed.activeMobileStep) ||
      !Array.isArray(parsed.selectedDestinations)
    ) {
      return null;
    }

    const selectedDestinations = parsed.selectedDestinations
      .map(parseSelectedPatientDestination)
      .filter(
        (destination): destination is SelectedPatientDestination => destination !== null,
      );

    if (selectedDestinations.length !== parsed.selectedDestinations.length) {
      return null;
    }

    return {
      version: 1,
      startAddress: parsed.startAddress,
      manualEndAddress: parsed.manualEndAddress,
      startGooglePlaceId: parsed.startGooglePlaceId,
      manualEndGooglePlaceId: parsed.manualEndGooglePlaceId,
      activeMobileStep: parsed.activeMobileStep,
      selectedDestinations,
    };
  } catch {
    return null;
  }
};

const persistRoutePlannerDraft = (draft: RoutePlannerDraft) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ROUTE_PLANNER_DRAFT_STORAGE_KEY,
    JSON.stringify(draft),
  );
};

const clearRoutePlannerDraft = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
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
  const [warningsDismissed, setWarningsDismissed] = useState(false);
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

  const googleMapsTripUrl = useMemo(() => {
    if (!result) {
      return null;
    }

    return buildGoogleMapsTripUrl(result);
  }, [result]);

  useEffect(() => {
    setWarningsDismissed(false);
  }, [result]);

  const hasIntermediateStops = useMemo(
    () => Boolean(result?.orderedStops.some((stop) => !stop.isEndingPoint)),
    [result],
  );

  const leaveBySuggestion = useMemo(() => {
    if (!result) {
      return null;
    }

    const firstScheduledStop = result.orderedStops.find(
      (stop) => !stop.isEndingPoint && stop.tasks.length > 0,
    );
    if (!firstScheduledStop) {
      return null;
    }

    const [firstTask] = firstScheduledStop.tasks;
    if (!firstTask) {
      return null;
    }

    const firstTaskStartMs = new Date(firstTask.serviceStartTime).getTime();
    if (firstTaskStartMs !== firstTaskStartMs) {
      return null;
    }

    const startLeg = result.routeLegs.find(
      (leg) => leg.fromStopId === "start" && leg.toStopId === firstScheduledStop.stopId,
    );
    const travelSecondsFromStart =
      startLeg?.durationSeconds ?? firstScheduledStop.durationFromPreviousSeconds;
    const leaveByMs = firstTaskStartMs - Math.max(0, travelSecondsFromStart) * 1000;
    if (leaveByMs !== leaveByMs) {
      return null;
    }

    const leaveByDate = new Date(leaveByMs);
    return {
      label: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      }).format(leaveByDate),
      travelDurationLabel: formatDuration(Math.max(0, travelSecondsFromStart)),
      firstPatientName: formatNameWords(firstTask.patientName),
    };
  }, [result]);

  const requestDestinations = useMemo(() => {
    return selectedDestinations.filter((destination) => destination.isIncluded);
  }, [selectedDestinations]);

  const overlappingVisitPairCount = useMemo(() => {
    let pairCount = 0;

    for (let leftIndex = 0; leftIndex < requestDestinations.length; leftIndex += 1) {
      const left = requestDestinations[leftIndex];
      if (!left || !hasCompleteWindow(left)) {
        continue;
      }

      for (let rightIndex = leftIndex + 1; rightIndex < requestDestinations.length; rightIndex += 1) {
        const right = requestDestinations[rightIndex];
        if (!right || !hasCompleteWindow(right)) {
          continue;
        }

        if (windowsOverlap(left, right)) {
          pairCount += 1;
        }
      }
    }

    return pairCount;
  }, [requestDestinations]);

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
              {overlappingVisitPairCount > 0 && (
                <p className="m-0 text-xs text-amber-700 dark:text-amber-300">
                  {overlappingVisitPairCount} overlap pair(s) detected.
                </p>
              )}
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
            {!isMobileViewport && overlappingVisitPairCount > 0 && (
              <p className="m-0 text-xs text-amber-700 dark:text-amber-300">
                {overlappingVisitPairCount} overlap pair(s) detected.
              </p>
            )}
            <span className={responsiveStyles.countPill}>
              {destinationCount} destination(s) detected
            </span>
            <button
              type="submit"
              disabled={isLoading || !canOptimize}
              className={`${responsiveStyles.optimizeButton} optimize-route-button`}
              data-loading={isLoading ? "true" : "false"}
              data-success={showOptimizeSuccess ? "true" : "false"}
            >
              {isLoading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isLoading ? "Optimizing..." : "Optimize Route"}
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
          <section className={`mt-4 ${responsiveStyles.surfaceCard}`}>
            <div className={responsiveStyles.resultHeader}>
              <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Optimized Route
              </h2>
              <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
                Review the route summary below, or open it in Google Maps for
                live navigation.
              </p>
            </div>

            {googleMapsTripUrl && (
              <div className={responsiveStyles.resultCtaStack}>
                <a
                  href={googleMapsTripUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={responsiveStyles.googleMapsButton}
                >
                  Open Planned Trip in Google Maps
                </a>
                <div className={responsiveStyles.resultInfoNote}>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 dark:border-slate-600 dark:text-slate-400"
                  >
                    i
                  </span>
                  <p className="m-0">
                    Google Maps may show a different ETA based on live traffic.
                  </p>
                </div>
              </div>
            )}

            <div className={responsiveStyles.resultStatsGrid}>
              <div className={responsiveStyles.resultStatCard}>
                <p className={responsiveStyles.resultStatLabel}>Distance</p>
                <p className={responsiveStyles.resultStatValue}>
                  {result.metrics.totalDistanceKm} km
                </p>
                <p className={responsiveStyles.resultStatMeta}>
                  Total planned driving distance
                </p>
              </div>
              <div className={responsiveStyles.resultStatCard}>
                <p className={responsiveStyles.resultStatLabel}>
                  Estimated Time
                </p>
                <p className={responsiveStyles.resultStatValue}>
                  {formatDuration(result.metrics.totalDurationSeconds)}
                </p>
                <p className={responsiveStyles.resultStatMeta}>
                  Excludes live traffic adjustments
                </p>
              </div>
            </div>

            {leaveBySuggestion && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                <p className="m-0 font-semibold">Suggested leave-by: {leaveBySuggestion.label}</p>
                <p className="m-0 text-xs text-emerald-700 dark:text-emerald-300">
                  Based on the first planned visit ({leaveBySuggestion.firstPatientName}) and a{" "}
                  {leaveBySuggestion.travelDurationLabel} drive from the starting point.
                </p>
              </div>
            )}

            {result.warnings && result.warnings.length > 0 && !warningsDismissed && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/70 dark:bg-red-950/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-red-800 dark:text-red-200">
                    Scheduling {result.warnings.length === 1 ? "Warning" : "Warnings"}
                  </p>
                  <button
                    type="button"
                    aria-label="Dismiss warnings"
                    onClick={() => setWarningsDismissed(true)}
                    className="shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <ul className="m-0 mt-1 space-y-0.5 pl-4">
                  {result.warnings.map((warning) => (
                    <li key={`${warning.type}:${warning.patientId}`} className="text-xs text-red-700 dark:text-red-300">
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <RouteMap
              start={result.start}
              orderedStops={result.orderedStops}
              routeLegs={result.routeLegs}
            />

            <div className={responsiveStyles.resultEndpoints}>
              <div className={responsiveStyles.resultEndpointCard}>
                <p className={responsiveStyles.resultEndpointLabel}>Start</p>
                <p className={responsiveStyles.resultEndpointValue}>
                  {result.start.address}
                </p>
              </div>
              <div className={responsiveStyles.resultEndpointCard}>
                <p className={responsiveStyles.resultEndpointLabel}>End</p>
                <p className={responsiveStyles.resultEndpointValue}>
                  {result.end.address}
                </p>
              </div>
            </div>

            {hasIntermediateStops && (
              <ol className="mb-0 mt-2 list-decimal space-y-2 pl-4 sm:pl-5">
                {result.orderedStops.map((stop) => (
                  <li
                    key={stop.stopId}
                    className="text-sm text-slate-800 dark:text-slate-200"
                  >
                    {stop.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {stop.tasks.map((task) => {
                          const formattedPatientName = formatNameWords(task.patientName);
                          const expectedStartLabel = formatExpectedStartTimeText(
                            task.serviceStartTime,
                          );
                          const detailsKey = `${task.visitId}`;
                          const isDetailsExpanded = Boolean(expandedResultTaskIds[detailsKey]);

                          return (
                            <div
                              key={task.visitId}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900/40"
                            >
                              <button
                                type="button"
                                aria-label={`Toggle details for ${formattedPatientName}`}
                                aria-expanded={isDetailsExpanded}
                                onClick={() => {
                                  setExpandedResultTaskIds((current) => ({
                                    ...current,
                                    [detailsKey]: !current[detailsKey],
                                  }));
                                }}
                                className="m-0 bg-transparent p-0 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                              >
                                {formattedPatientName}
                              </button>

                              {expectedStartLabel && (
                                <p className="m-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  {expectedStartLabel}
                                </p>
                              )}

                              {task.windowStart && task.windowEnd && task.lateBySeconds > 0 && (
                                <p className={[
                                  "m-0 text-xs font-semibold",
                                  task.windowType === "fixed" && task.lateBySeconds > 15 * 60
                                    ? "text-red-600 dark:text-red-400"
                                    : task.windowType === "flexible" && task.lateBySeconds > 60 * 60
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-red-600 dark:text-red-400",
                                ].join(" ")}>
                                  Outside preferred window by {Math.ceil(task.lateBySeconds / 60)}{" "}
                                  min
                                </p>
                              )}

                              {isDetailsExpanded && (
                                <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                                  <p className="m-0">Address: {task.address}</p>
                                  <p className="m-0">
                                    Preferred window:{" "}
                                    {task.windowStart && task.windowEnd
                                      ? `${task.windowStart} - ${task.windowEnd}`
                                      : "No preferred window"}
                                  </p>
                                  <p className="m-0">Visit type: {task.windowType}</p>
                                  <p className="m-0">
                                    Duration:{" "}
                                    {formatVisitDurationMinutes(task.serviceDurationMinutes)}
                                  </p>
                                </div>
                              )}

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {stop.distanceFromPreviousKm} km •{" "}
                                {formatDuration(stop.durationFromPreviousSeconds)} from previous
                                stop
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        {stop.isEndingPoint ? (
                          (() => {
                            const endingDetailsKey = `ending:${stop.stopId}`;
                            const isEndingDetailsExpanded = Boolean(
                              expandedResultEndingStopIds[endingDetailsKey],
                            );
                            const isHomeEndingPoint = addressesMatch(
                              stop.address,
                              normalizedHomeAddress,
                            );

                            return (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                                <button
                                  type="button"
                                  aria-label={`Toggle details for ${isHomeEndingPoint ? "Home ending point" : "Ending point"}`}
                                  aria-expanded={isEndingDetailsExpanded}
                                  onClick={() => {
                                    setExpandedResultEndingStopIds((current) => ({
                                      ...current,
                                      [endingDetailsKey]: !current[endingDetailsKey],
                                    }));
                                  }}
                                  className="m-0 bg-transparent p-0 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                                >
                                  {isHomeEndingPoint ? "Home" : stop.address}
                                </button>

                                {isEndingDetailsExpanded && (
                                  <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                                    {isHomeEndingPoint && (
                                      <p className="m-0">Address: {stop.address}</p>
                                    )}
                                    <p className="m-0">Ending Point.</p>
                                  </div>
                                )}

                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {stop.distanceFromPreviousKm} km •{" "}
                                  {formatDuration(stop.durationFromPreviousSeconds)} from previous
                                  stop
                                </p>
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            <span>{stop.address}</span>
                            <small className="block text-xs font-medium text-blue-600 dark:text-blue-300">
                              No scheduled visit tasks at this stop.
                            </small>
                          </>
                        )}
                      </>
                    )}
                    {stop.tasks.length === 0 && !stop.isEndingPoint && (
                      <small className="block text-xs text-slate-500 dark:text-slate-400">
                        {stop.distanceFromPreviousKm} km •{" "}
                        {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
                      </small>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {result.unscheduledTasks.length > 0 && (
              <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <h3 className="m-0 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Unscheduled Visits ({result.unscheduledTasks.length})
                </h3>
                <p className="mb-2 mt-1 text-xs text-amber-800 dark:text-amber-300">
                  These visits could not be placed in the optimized route.
                </p>
                <ul className="m-0 space-y-2 pl-4 sm:pl-5">
                  {result.unscheduledTasks.map((task) => (
                    <li
                      key={task.visitId}
                      className="text-sm text-amber-900 dark:text-amber-200"
                    >
                      <p className="m-0 font-medium">
                        {task.patientName ? formatNameWords(task.patientName) : task.patientId}
                      </p>
                      {task.address && (
                        <p className="m-0 text-xs text-amber-800 dark:text-amber-300">
                          {task.address}
                        </p>
                      )}
                      {task.windowStart && task.windowEnd && (
                        <p className="m-0 text-xs text-amber-800 dark:text-amber-300">
                          {task.windowStart} - {task.windowEnd}
                          {task.windowType ? ` • ${task.windowType}` : ""}
                        </p>
                      )}
                      <p className="m-0 text-xs text-amber-800 dark:text-amber-300">
                        Reason: {unscheduledReasonLabels[task.reason]}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>
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
