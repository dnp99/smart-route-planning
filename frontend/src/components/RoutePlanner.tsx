import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import ThemeToggle from "./ThemeToggle";
import type { Patient } from "../../../shared/contracts";
import { usePatientSearch } from "./routePlanner/usePatientSearch";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlanner/routePlannerUtils";
import { useTheme } from "./routePlanner/useTheme";

type EndMode = "manual" | "patient";

type SelectedPatientDestination = {
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
};

const toSelectedPatientDestination = (
  patient: Patient,
): SelectedPatientDestination => ({
  patientId: patient.id,
  patientName: `${patient.firstName} ${patient.lastName}`.trim(),
  address: patient.address,
  googlePlaceId: patient.googlePlaceId,
});

function RoutePlanner() {
  const { theme, toggleTheme } = useTheme();
  const [startAddress, setStartAddress] = useState(
    "3361 Ingram Road, Mississauga, ON",
  );
  const [manualEndAddress, setManualEndAddress] = useState("");
  const [endMode, setEndMode] = useState<EndMode>("manual");

  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [endPatientSearchQuery, setEndPatientSearchQuery] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<
    SelectedPatientDestination[]
  >([]);
  const [selectedEndPatient, setSelectedEndPatient] = useState<
    SelectedPatientDestination | null
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
    if (endMode !== "patient" || !selectedEndPatient) {
      return selectedDestinations;
    }

    return [...selectedDestinations, selectedEndPatient];
  }, [endMode, selectedDestinations, selectedEndPatient]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    void optimizeRoute({
      startAddress,
      endAddress: resolvedEndAddress,
      destinations: requestDestinations,
      canOptimize,
    });
  };

  const addDestinationPatient = (patient: Patient) => {
    const destination = toSelectedPatientDestination(patient);

    if (selectedEndPatient?.patientId === destination.patientId) {
      return;
    }

    setSelectedDestinations((current) => {
      if (current.some((entry) => entry.patientId === destination.patientId)) {
        return current;
      }

      return [...current, destination];
    });
  };

  const removeDestinationPatient = (patientId: string) => {
    setSelectedDestinations((current) =>
      current.filter((entry) => entry.patientId !== patientId),
    );
  };

  const selectEndPatient = (patient: Patient) => {
    const destination = toSelectedPatientDestination(patient);
    setSelectedEndPatient(destination);
    setSelectedDestinations((current) =>
      current.filter((entry) => entry.patientId !== destination.patientId),
    );
    setEndTouched(true);
  };

  const clearEndPatient = () => {
    setSelectedEndPatient(null);
    setEndTouched(true);
  };

  const destinationCount = selectedDestinations.length;

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
            addresses. The app returns a nearest-next-stop route with the
            ending point as the final stop.
          </p>
        </div>

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          <AddressAutocompleteInput
            id="startAddress"
            label="Starting point"
            placeholder="e.g. 1 Apple Park Way, Cupertino"
            value={startAddress}
            onChange={setStartAddress}
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
            onChange={setManualEndAddress}
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

          {endMode === "patient" && (
            <div className="grid gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <label
                htmlFor="end-patient-search"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Select end patient
              </label>
              <input
                id="end-patient-search"
                type="search"
                value={endPatientSearchQuery}
                onChange={(event) => setEndPatientSearchQuery(event.target.value)}
                onBlur={() => setEndTouched(true)}
                placeholder="Search patient by first or last name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                  <button
                    type="button"
                    onClick={clearEndPatient}
                    className="mt-2 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                  >
                    Clear end patient
                  </button>
                </div>
              ) : (
                <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
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
                <ul className="m-0 max-h-48 list-none space-y-2 overflow-y-auto p-0">
                  {endPatientSearchResults.map((patient) => {
                    const patientName = `${patient.firstName} ${patient.lastName}`.trim();

                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => selectEndPatient(patient)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
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
            </div>
          )}

          <div className="grid gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <label
              htmlFor="destination-patient-search"
              className="text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Destination patient search
            </label>
            <input
              id="destination-patient-search"
              type="search"
              value={destinationSearchQuery}
              onChange={(event) => setDestinationSearchQuery(event.target.value)}
              placeholder="Search saved patients by first or last name"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              <ul className="m-0 max-h-48 list-none space-y-2 overflow-y-auto p-0">
                {destinationSearchResults.map((patient) => {
                  const patientName = `${patient.firstName} ${patient.lastName}`.trim();

                  return (
                    <li key={patient.id}>
                      <button
                        type="button"
                        onClick={() => addDestinationPatient(patient)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
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
          </div>

          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Selected destination patients
          </label>
          <div className={responsiveStyles.destinationList}>
            {selectedDestinations.length === 0 ? (
              <p className="m-0 text-sm text-slate-400 dark:text-slate-500">
                No destination patients selected yet.
              </p>
            ) : (
              <ol className="m-0 space-y-2">
                {selectedDestinations.map((destination, index) => (
                  <li
                    key={destination.patientId}
                    className={responsiveStyles.destinationItem}
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
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDestinationPatient(destination.patientId)}
                      className={responsiveStyles.destinationRemove}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={responsiveStyles.footerRow}>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
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

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                  {result.totalDistanceKm} km
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
                  {formatDuration(result.totalDurationSeconds)}
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
                {result.orderedStops.map((stop, index) => (
                  <li
                    key={`${stop.address}-${index}`}
                    className="text-sm text-slate-800 dark:text-slate-200"
                  >
                      <span>{stop.address}</span>
                      {stop.patientName && (
                        <small className="block text-xs font-medium text-blue-600 dark:text-blue-300">
                          Patient: {stop.patientName}
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
          </section>
        )}
      </section>
    </main>
  );
}

export default RoutePlanner;
