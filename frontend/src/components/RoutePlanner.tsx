import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import ThemeToggle from "./ThemeToggle";
import type { Patient } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { persistPlanningWindows } from "./routePlanner/routePlannerService";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlanner/routePlannerUtils";
import { useTheme } from "./routePlanner/useTheme";
import type { AddressSuggestion } from "./types";
import { formatNameWords, formatPatientNameFromParts } from "./patients/patientName";

type EndMode = "manual" | "patient";

type SelectedPatientDestination = {
  visitKey: string;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: "fixed" | "flexible";
  requiresPlanningWindow: boolean;
  isIncluded: boolean;
  persistPlanningWindow: boolean;
};

type SelectedEndPatient = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
  visitDestinations: SelectedPatientDestination[];
};

const toWindowTime = (value: string) => value.slice(0, 5);
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (value: string) => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

const hasCompleteWindow = (destination: SelectedPatientDestination) =>
  HH_MM_PATTERN.test(destination.windowStart) && HH_MM_PATTERN.test(destination.windowEnd);

const hasOverlappingWindows = (destinations: SelectedPatientDestination[]) => {
  const sorted = [...destinations].sort((left, right) => {
    const startDelta = timeToMinutes(left.windowStart) - timeToMinutes(right.windowStart);
    if (startDelta !== 0) {
      return startDelta;
    }

    const endDelta = timeToMinutes(left.windowEnd) - timeToMinutes(right.windowEnd);
    if (endDelta !== 0) {
      return endDelta;
    }

    return left.visitKey.localeCompare(right.visitKey);
  });

  for (let index = 1; index < sorted.length; index += 1) {
    if (timeToMinutes(sorted[index].windowStart) < timeToMinutes(sorted[index - 1].windowEnd)) {
      return true;
    }
  }

  return false;
};

const toSelectedPatientDestinations = (
  patient: Patient,
): SelectedPatientDestination[] => {
  const patientName = formatPatientNameFromParts(patient.firstName, patient.lastName);
  const patientVisitWindows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (patientVisitWindows.length > 0) {
    return patientVisitWindows.map((window) => ({
      visitKey: `${patient.id}:${window.id}`,
      patientId: patient.id,
      patientName,
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
      windowStart: toWindowTime(window.startTime),
      windowEnd: toWindowTime(window.endTime),
      windowType: window.visitTimeType,
      requiresPlanningWindow: false,
      isIncluded: true,
      persistPlanningWindow: false,
    }));
  }

  if (patient.visitTimeType === "flexible") {
    return [
      {
        visitKey: `${patient.id}:planning-window`,
        patientId: patient.id,
        patientName,
        address: patient.address,
        googlePlaceId: patient.googlePlaceId,
        windowStart: "",
        windowEnd: "",
        windowType: "flexible",
        requiresPlanningWindow: true,
        isIncluded: true,
        persistPlanningWindow: false,
      },
    ];
  }

  return [
    {
      visitKey: `${patient.id}:legacy`,
      patientId: patient.id,
      patientName,
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
      windowStart: toWindowTime(patient.preferredVisitStartTime),
      windowEnd: toWindowTime(patient.preferredVisitEndTime),
      windowType: patient.visitTimeType,
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

function RoutePlanner() {
  const { theme, toggleTheme } = useTheme();
  const [startAddress, setStartAddress] = useState(
    "3361 Ingram Road, Mississauga, ON",
  );
  const [manualEndAddress, setManualEndAddress] = useState("");
  const [startGooglePlaceId, setStartGooglePlaceId] = useState<string | null>(null);
  const [manualEndGooglePlaceId, setManualEndGooglePlaceId] = useState<string | null>(null);
  const [endMode, setEndMode] = useState<EndMode>("manual");

  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [endPatientSearchQuery, setEndPatientSearchQuery] = useState("");
  const [localValidationError, setLocalValidationError] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<
    SelectedPatientDestination[]
  >([]);
  const [selectedEndPatient, setSelectedEndPatient] = useState<
    SelectedEndPatient | null
  >(null);

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

  const requestDestinations = useMemo(() => {
    const includedDestinationVisits = selectedDestinations.filter(
      (destination) => destination.isIncluded,
    );

    if (endMode !== "patient" || !selectedEndPatient) {
      return includedDestinationVisits;
    }

    return [
      ...includedDestinationVisits,
      ...selectedEndPatient.visitDestinations.filter((destination) => destination.isIncluded),
    ];
  }, [endMode, selectedDestinations, selectedEndPatient]);

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

  const updateEndPatientPlanningWindow = (
    visitKey: string,
    field: "windowStart" | "windowEnd",
    value: string,
  ) => {
    setSelectedEndPatient((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        visitDestinations: current.visitDestinations.map((destination) =>
          destination.visitKey === visitKey
            ? {
                ...destination,
                [field]: value,
              }
            : destination,
        ),
      };
    });
  };

  const setEndPatientVisitIncluded = (visitKey: string, isIncluded: boolean) => {
    setSelectedEndPatient((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        visitDestinations: current.visitDestinations.map((destination) =>
          destination.visitKey === visitKey
            ? {
                ...destination,
                isIncluded,
              }
            : destination,
        ),
      };
    });
  };

  const setEndPatientPersistPlanningWindow = (
    visitKey: string,
    persistPlanningWindow: boolean,
  ) => {
    setSelectedEndPatient((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        visitDestinations: current.visitDestinations.map((destination) =>
          destination.visitKey === visitKey
            ? {
                ...destination,
                persistPlanningWindow,
              }
            : destination,
        ),
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalValidationError("");

    if (requestDestinations.some((destination) => !hasCompleteWindow(destination))) {
      setLocalValidationError(
        "Set start and end time for flexible patients without preferred windows before optimizing.",
      );
      return;
    }

    if (
      requestDestinations.some(
        (destination) => timeToMinutes(destination.windowEnd) <= timeToMinutes(destination.windowStart),
      )
    ) {
      setLocalValidationError(
        "All selected visit windows must end after they start.",
      );
      return;
    }

    if (hasOverlappingWindows(requestDestinations)) {
      setLocalValidationError("Selected patient windows overlap. Please adjust patient timings before planning.");
      return;
    }

    const optimizeDestinations = requestDestinations.map(
      ({
        visitKey: _visitKey,
        requiresPlanningWindow: _requiresPlanningWindow,
        isIncluded: _isIncluded,
        persistPlanningWindow: _persistPlanningWindow,
        ...destination
      }) =>
        destination,
    );

    const planningWindowsToPersist = requestDestinations
      .filter((destination) => destination.requiresPlanningWindow && destination.persistPlanningWindow)
      .map((destination) => ({
        patientId: destination.patientId,
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
  };

  const removeDestinationVisit = (visitKey: string) => {
    setSelectedDestinations((current) =>
      current.filter((entry) => entry.visitKey !== visitKey),
    );
  };

  const selectEndPatient = (patient: Patient) => {
    const visitDestinations = toSelectedPatientDestinations(patient);
    setSelectedEndPatient({
      patientId: patient.id,
      patientName: formatPatientNameFromParts(patient.firstName, patient.lastName),
      address: patient.address,
      googlePlaceId: patient.googlePlaceId,
      visitDestinations,
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

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">
              Smart Route Planner
            </h1>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
            Enter your starting point, ending point, and destination
            addresses. The planner prioritizes time-window feasibility first,
            then distance, with the ending point as the final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
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
          </section>

          {endMode === "patient" && (
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
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                  <p className="m-0 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    End patient: {selectedEndPatient.patientName}
                  </p>
                  <p className="m-0 text-sm text-emerald-700 dark:text-emerald-300">
                    {selectedEndPatient.address}
                  </p>
                  <p className="m-0 text-xs text-emerald-700 dark:text-emerald-300">
                    {
                      selectedEndPatient.visitDestinations.filter((destination) => destination.isIncluded)
                        .length
                    }{" "}
                    visit window(s) selected
                  </p>
                  <div className="mt-2 grid gap-2">
                    {selectedEndPatient.visitDestinations.map((destination, index) => (
                      <div
                        key={destination.visitKey}
                        className="grid gap-2 rounded-lg border border-emerald-300/70 p-2 dark:border-emerald-800"
                      >
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                          <input
                            type="checkbox"
                            checked={destination.isIncluded}
                            onChange={(event) =>
                              setEndPatientVisitIncluded(destination.visitKey, event.target.checked)
                            }
                          />
                          Include visit window {index + 1}
                        </label>

                        {destination.requiresPlanningWindow ? (
                          <div className="grid gap-2">
                            <p className="m-0 text-xs text-emerald-800 dark:text-emerald-300">
                              Set planning window
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="time"
                                aria-label={`End patient ${destination.patientName} start`}
                                value={destination.windowStart}
                                onChange={(event) =>
                                  updateEndPatientPlanningWindow(
                                    destination.visitKey,
                                    "windowStart",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100"
                              />
                              <input
                                type="time"
                                aria-label={`End patient ${destination.patientName} end`}
                                value={destination.windowEnd}
                                onChange={(event) =>
                                  updateEndPatientPlanningWindow(
                                    destination.visitKey,
                                    "windowEnd",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100"
                              />
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                              <input
                                type="checkbox"
                                checked={destination.persistPlanningWindow}
                                onChange={(event) =>
                                  setEndPatientPersistPlanningWindow(
                                    destination.visitKey,
                                    event.target.checked,
                                  )
                                }
                              />
                              Save this window to patient record
                            </label>
                          </div>
                        ) : (
                          <p className="m-0 text-xs text-emerald-800 dark:text-emerald-300">
                            {destination.windowStart} - {destination.windowEnd} • {destination.windowType}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearEndPatient}
                    className="mt-2 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
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
                {selectedDestinations.map((destination, index) => (
                  <li
                    key={destination.visitKey}
                    className={`${responsiveStyles.destinationItem} ${
                      destination.isIncluded ? "" : "opacity-60"
                    }`}
                  >
                    <div className={responsiveStyles.destinationItemBody}>
                      <span className="min-w-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {index + 1}.
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm">
                        <span className="block font-semibold text-slate-900 dark:text-slate-100">
                          {destination.patientName}
                        </span>
                        <span className="block text-slate-600 dark:text-slate-300">
                          {destination.address}
                        </span>
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
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
                        {destination.requiresPlanningWindow ? (
                          <div className="mt-2">
                            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                              Flexible with no preferred window. Pick a planning time:
                            </p>
                            <div className="mt-1 flex gap-2">
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
                            <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
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
                        ) : (
                          <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                            {destination.windowStart} - {destination.windowEnd} •{" "}
                            {destination.windowType}
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDestinationVisit(destination.visitKey)}
                      className={responsiveStyles.destinationRemove}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}
            </div>
          </section>

          <div className={responsiveStyles.footerRow}>
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
        </form>

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
              <ol className="mb-0 mt-2 list-decimal space-y-2 pl-5">
                {result.orderedStops.map((stop) => (
                  <li
                    key={stop.stopId}
                    className="text-sm text-slate-800 dark:text-slate-200"
                  >
                    <span>{stop.address}</span>
                    {stop.tasks.length > 0 ? (
                      <>
                        {stop.tasks.map((task) => (
                          <small
                            key={task.visitId}
                            className="block text-xs font-medium text-blue-600 dark:text-blue-300"
                          >
                            Patient: {formatNameWords(task.patientName)} • {task.windowStart} -{" "}
                            {task.windowEnd} • {task.windowType}
                          </small>
                        ))}
                      </>
                    ) : (
                      <small className="block text-xs font-medium text-blue-600 dark:text-blue-300">
                        No scheduled visit tasks at this stop.
                      </small>
                    )}
                    <small className="block text-xs text-slate-500 dark:text-slate-400">
                      {stop.distanceFromPreviousKm} km •{" "}
                      {formatDuration(stop.durationFromPreviousSeconds)} from
                      previous stop
                      {stop.isEndingPoint ? " • ending point" : ""}
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
                <ul className="m-0 space-y-2 pl-5">
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
