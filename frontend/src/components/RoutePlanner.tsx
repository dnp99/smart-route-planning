import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import type { Patient } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlanner/routePlannerUtils";
import type { AddressSuggestion } from "./types";
import { formatNameWords, formatPatientNameFromParts } from "./patients/patientName";

type EndMode = "manual" | "patient";
type MobilePlannerStep = "trip" | "patients" | "review";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const ROUTE_PLANNER_DRAFT_STORAGE_KEY = "careflow.route-planner.draft.v1";

type SelectedPatientDestination = {
  visitKey: string;
  sourceWindowId: string | null;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: "fixed" | "flexible";
  serviceDurationMinutes: number;
  requiresPlanningWindow: boolean;
  isIncluded: boolean;
  persistPlanningWindow: boolean;
};

type SelectedEndPatient = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
};

type RoutePlannerDraft = {
  version: 1;
  startAddress: string;
  manualEndAddress: string;
  startGooglePlaceId: string | null;
  manualEndGooglePlaceId: string | null;
  endMode: EndMode;
  activeMobileStep: MobilePlannerStep;
  selectedDestinations: SelectedPatientDestination[];
  selectedEndPatient: SelectedEndPatient | null;
};

const toWindowTime = (value: string) => value.slice(0, 5);
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
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

const panelEmptyTextClassName =
  "m-0 text-sm text-slate-500 dark:text-slate-400";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWindowType = (value: unknown): value is "fixed" | "flexible" =>
  value === "fixed" || value === "flexible";

const isEndMode = (value: unknown): value is EndMode =>
  value === "manual" || value === "patient";

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

const parseSelectedEndPatient = (value: unknown): SelectedEndPatient | null => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.patientId !== "string" ||
    typeof value.patientName !== "string" ||
    typeof value.address !== "string" ||
    (value.googlePlaceId !== null && typeof value.googlePlaceId !== "string")
  ) {
    return null;
  }

  return {
    patientId: value.patientId,
    patientName: value.patientName,
    address: value.address,
    googlePlaceId: value.googlePlaceId,
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
      !isEndMode(parsed.endMode) ||
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

    const selectedEndPatient = parseSelectedEndPatient(parsed.selectedEndPatient);
    if (parsed.selectedEndPatient !== null && selectedEndPatient === null) {
      return null;
    }

    return {
      version: 1,
      startAddress: parsed.startAddress,
      manualEndAddress: parsed.manualEndAddress,
      startGooglePlaceId: parsed.startGooglePlaceId,
      manualEndGooglePlaceId: parsed.manualEndGooglePlaceId,
      endMode: parsed.endMode,
      activeMobileStep: parsed.activeMobileStep,
      selectedDestinations,
      selectedEndPatient,
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

function RoutePlanner() {
  const initialDraft = useMemo(() => readRoutePlannerDraft(), []);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const [activeMobileStep, setActiveMobileStep] =
    useState<MobilePlannerStep>(initialDraft?.activeMobileStep ?? "trip");
  const [startAddress, setStartAddress] = useState(
    initialDraft?.startAddress ?? "3361 Ingram Road, Mississauga, ON",
  );
  const [manualEndAddress, setManualEndAddress] = useState(
    initialDraft?.manualEndAddress ?? "",
  );
  const [startGooglePlaceId, setStartGooglePlaceId] = useState<string | null>(
    initialDraft?.startGooglePlaceId ?? null,
  );
  const [manualEndGooglePlaceId, setManualEndGooglePlaceId] = useState<string | null>(
    initialDraft?.manualEndGooglePlaceId ?? null,
  );
  const [endMode, setEndMode] = useState<EndMode>(initialDraft?.endMode ?? "manual");

  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [endPatientSearchQuery, setEndPatientSearchQuery] = useState("");
  const [localValidationError, setLocalValidationError] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<
    SelectedPatientDestination[]
  >(initialDraft?.selectedDestinations ?? []);
  const [expandedDestinationVisitKeys, setExpandedDestinationVisitKeys] =
    useState<Record<string, boolean>>({});
  const [expandedResultTaskIds, setExpandedResultTaskIds] = useState<
    Record<string, boolean>
  >({});
  const [selectedEndPatient, setSelectedEndPatient] = useState<
    SelectedEndPatient | null
  >(initialDraft?.selectedEndPatient ?? null);

  const {
    patients: destinationSearchPatients,
    isLoading: isDestinationSearchLoading,
    error: destinationSearchError,
  } = usePatientSearch({
    query: destinationSearchQuery,
    enabled: true,
  });

  const {
    patients: endPatientSearchPatients,
    isLoading: isEndPatientSearchLoading,
    error: endPatientSearchError,
  } = usePatientSearch({
    query: endPatientSearchQuery,
    enabled: endMode === "patient",
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
  }, [result]);

  useEffect(() => {
    persistRoutePlannerDraft({
      version: 1,
      startAddress,
      manualEndAddress,
      startGooglePlaceId,
      manualEndGooglePlaceId,
      endMode,
      activeMobileStep,
      selectedDestinations,
      selectedEndPatient,
    });
  }, [
    activeMobileStep,
    endMode,
    manualEndAddress,
    manualEndGooglePlaceId,
    selectedDestinations,
    selectedEndPatient,
    startAddress,
    startGooglePlaceId,
  ]);

  const selectedDestinationIdSet = useMemo(
    () => new Set(selectedDestinations.map((destination) => destination.patientId)),
    [selectedDestinations],
  );

  const destinationSearchResults = useMemo(() => {
    return destinationSearchPatients.filter((patient) => {
      if (selectedDestinationIdSet.has(patient.id)) {
        return false;
      }

      return selectedEndPatient?.patientId !== patient.id;
    });
  }, [destinationSearchPatients, selectedDestinationIdSet, selectedEndPatient]);

  const endPatientSearchResults = useMemo(() => {
    return endPatientSearchPatients;
  }, [endPatientSearchPatients]);

  const resolvedEndAddress =
    endMode === "manual" ? manualEndAddress : selectedEndPatient?.address ?? "";
  const resolvedEndGooglePlaceId =
    endMode === "manual" ? manualEndGooglePlaceId : undefined;

  const canOptimize =
    startAddress.trim().length > 0 && resolvedEndAddress.trim().length > 0;

  const optimizeEndpointHint = useMemo(() => {
    if (endMode === "manual" && manualEndAddress.trim().length === 0) {
      return "Select an ending point to enable route optimization.";
    }

    if (endMode === "patient" && !selectedEndPatient) {
      return "Select an end patient to enable route optimization.";
    }

    return undefined;
  }, [endMode, manualEndAddress, selectedEndPatient]);

  const startFieldError =
    (hasAttemptedOptimize || startTouched) && startAddress.trim().length === 0
      ? "Starting point is required."
      : undefined;

  const endFieldError = useMemo(() => {
    if (!(hasAttemptedOptimize || endTouched)) {
      return undefined;
    }

    if (endMode === "manual" && manualEndAddress.trim().length === 0) {
      return "Ending point is required in manual mode.";
    }

    if (endMode === "patient" && !selectedEndPatient) {
      return "Select a patient as the ending point.";
    }

    return undefined;
  }, [
    endMode,
    endTouched,
    hasAttemptedOptimize,
    manualEndAddress,
    selectedEndPatient,
  ]);

  const googleMapsTripUrl = useMemo(() => {
    if (!result) {
      return null;
    }

    return buildGoogleMapsTripUrl(result);
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

    if (selectedEndPatient?.patientId === patient.id) {
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

  const selectEndPatient = (patient: Patient) => {
    setSelectedEndPatient({
      patientId: patient.id,
      patientName: formatPatientNameFromParts(patient.firstName, patient.lastName),
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
    });
    setSelectedDestinations((current) =>
      current.filter((entry) => entry.patientId !== patient.id),
    );
    setEndTouched(true);
  };

  const clearEndPatient = () => {
    setSelectedEndPatient(null);
    setEndTouched(true);
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
                onBlur={() => {
                  if (endMode === "manual") {
                    setEndTouched(true);
                  }
                }}
                helperText={
                  endMode === "manual"
                    ? "Type at least 3 characters to see suggestions."
                    : "Switch to Manual end address mode to edit this field."
                }
                errorText={endMode === "manual" ? endFieldError : undefined}
                required={endMode === "manual"}
                disabled={endMode !== "manual"}
              />

              <fieldset className="grid gap-2 rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700">
                <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  End mode
                </legend>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="end-mode"
                    checked={endMode === "manual"}
                    onChange={() => {
                      setEndMode("manual");
                      setEndTouched(false);
                    }}
                  />
                  Manual end address
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="end-mode"
                    checked={endMode === "patient"}
                    onChange={() => {
                      setEndMode("patient");
                      setEndTouched(false);
                    }}
                  />
                  Patient end address
                </label>
              </fieldset>

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

          {endMode === "patient" && isTripStepVisible && (
            <section className={responsiveStyles.panel}>
              <div className={responsiveStyles.cardHeader}>
                <h2 className={responsiveStyles.cardTitle}>Select end patient</h2>
                <p className={responsiveStyles.cardDescription}>
                  Search the patient roster and set the final stop for the day.
                </p>
              </div>
              <input
                id="end-patient-search"
                type="search"
                aria-label="Select end patient"
                value={endPatientSearchQuery}
                onChange={(event) => setEndPatientSearchQuery(event.target.value)}
                onBlur={() => setEndTouched(true)}
                placeholder="Search patient by first or last name"
                className={responsiveStyles.searchInput}
              />

              {endFieldError && (
                <p className="m-0 text-xs text-red-600 dark:text-red-400">
                  {endFieldError}
                </p>
              )}

              {selectedEndPatient ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/25 sm:px-4">
                  <p className="m-0 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    End patient: {selectedEndPatient.patientName}
                  </p>
                  <p className="m-0 text-sm text-emerald-700 dark:text-emerald-300">
                    {selectedEndPatient.address}
                  </p>
                  <button
                    type="button"
                    onClick={clearEndPatient}
                    className="mt-2 w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40 sm:w-auto sm:py-1"
                  >
                    Clear end patient
                  </button>
                </div>
              ) : (
                <p className={panelEmptyTextClassName}>
                  No end patient selected yet.
                </p>
              )}

              {isEndPatientSearchLoading && (
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                  Loading patients…
                </p>
              )}

              {endPatientSearchError && (
                <p className="m-0 text-xs text-amber-700 dark:text-amber-300">
                  {endPatientSearchError}
                </p>
              )}

              {endPatientSearchResults.length > 0 && (
                <ul className={responsiveStyles.selectableList}>
                {endPatientSearchResults.map((patient) => {
                    const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);

                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => selectEndPatient(patient)}
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

          {isPatientsStepVisible && (
            <section className={responsiveStyles.panel}>
            <div className={responsiveStyles.cardHeader}>
              <h2 className={responsiveStyles.cardTitle}>
                Destination patient search
              </h2>
              <p className={responsiveStyles.cardDescription}>
                Add saved patients as route stops before optimizing the visit order.
              </p>
            </div>
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

          {isPatientsStepVisible && (
            <section className={responsiveStyles.panel}>
            <div className={responsiveStyles.cardHeader}>
              <h2 className={responsiveStyles.cardTitle}>
                Selected destination patients
              </h2>
              <p className={responsiveStyles.cardDescription}>
                Review the patients included in the route before you optimize it.
              </p>
            </div>
            <div className={responsiveStyles.destinationList}>
            {selectedDestinations.length === 0 ? (
              <p className={panelEmptyTextClassName}>
                No destination patients selected yet.
              </p>
            ) : (
              <ol className="m-0 space-y-2">
                {selectedDestinations.map((destination, index) => {
                  const isDestinationExpanded =
                    expandedDestinationVisitKeys[destination.visitKey] ??
                    false;
                  return (
                    <li
                      key={destination.visitKey}
                      className={`${responsiveStyles.destinationItem} rounded-xl border border-transparent px-2 py-2 dark:border-transparent ${
                        destination.isIncluded ? "" : "opacity-60"
                      }`}
                    >
                      <div className={responsiveStyles.destinationItemBody}>
                        <span className="min-w-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1 break-words text-sm">
                          <span className="block font-semibold text-slate-900 dark:text-slate-100">
                            {destination.patientName}
                          </span>
                          <span className="block text-slate-600 dark:text-slate-300">
                            {destination.address}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleDestinationDetails(destination.visitKey)}
                              className={responsiveStyles.destinationDetailsToggle}
                            >
                              {isDestinationExpanded ? "Hide details" : "Edit window"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDestinationVisit(destination.visitKey)}
                              className={responsiveStyles.destinationRemove}
                            >
                              Remove
                            </button>
                          </div>
                          {isDestinationExpanded && (
                            <>
                          <label className="mt-2 inline-flex items-start gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={destination.isIncluded}
                              onChange={(event) =>
                                setDestinationVisitIncluded(
                                  destination.visitKey,
                                  event.target.checked,
                                )
                              }
                            />
                            Include this visit in route
                          </label>
                          <div className="mt-2">
                            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                              {destination.requiresPlanningWindow
                                ? "No preferred window. Optimizer will auto-schedule unless you set one:"
                                : "Adjust planning window (plan-only unless saved):"}
                            </p>
                            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <input
                                type="time"
                                aria-label={`${destination.patientName} start`}
                                value={destination.windowStart}
                                onChange={(event) =>
                                  updateDestinationPlanningWindow(
                                    destination.visitKey,
                                    "windowStart",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              />
                              <input
                                type="time"
                                aria-label={`${destination.patientName} end`}
                                value={destination.windowEnd}
                                onChange={(event) =>
                                  updateDestinationPlanningWindow(
                                    destination.visitKey,
                                    "windowEnd",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              />
                            </div>
                            <label className="mt-2 inline-flex items-start gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={destination.persistPlanningWindow}
                                onChange={(event) =>
                                  setDestinationPersistPlanningWindow(
                                    destination.visitKey,
                                    event.target.checked,
                                  )
                                }
                              />
                              Save this window to patient record
                            </label>
                          </div>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            </div>
            {isMobileViewport && (
              <button
                type="button"
                onClick={() => setActiveMobileStep("review")}
                className={responsiveStyles.secondaryButton}
              >
                Continue to Review
              </button>
            )}
            </section>
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
                                <p className="m-0 text-xs font-semibold text-red-600 dark:text-red-400">
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
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <span>
                          {stop.address}
                          {stop.isEndingPoint ? " • Ending point" : ""}
                        </span>
                        <small className="block text-xs font-medium text-blue-600 dark:text-blue-300">
                          No scheduled visit tasks at this stop.
                        </small>
                      </>
                    )}
                    <small className="block text-xs text-slate-500 dark:text-slate-400">
                      {stop.distanceFromPreviousKm} km •{" "}
                      {formatDuration(stop.durationFromPreviousSeconds)} from
                      previous stop
                    </small>
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
    </main>
  );
}

export default RoutePlanner;
