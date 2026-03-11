import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import ThemeToggle from "./ThemeToggle";
import { useDestinationAddresses } from "./routePlanner/useDestinationAddresses";
import { useRouteOptimization } from "./routePlanner/useRouteOptimization";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlanner/routePlannerUtils";
import { useTheme } from "./routePlanner/useTheme";

function RoutePlanner() {
  const { theme, toggleTheme } = useTheme();
  const [startAddress, setStartAddress] = useState(
    "3361 Ingram Road, Mississauga, ON",
  );
  const [endAddress, setEndAddress] = useState("");
  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  const {
    addressCount,
    destinationAddresses,
    destinationDraft,
    setDestinationDraft,
    addDestinationAddress,
    removeDestinationAddress,
  } = useDestinationAddresses();

  const {
    result,
    error,
    isLoading,
    showOptimizeSuccess,
    hasAttemptedOptimize,
    optimizeRoute,
  } = useRouteOptimization();

  const canOptimize =
    startAddress.trim().length > 0 && endAddress.trim().length > 0;

  const startFieldError =
    (hasAttemptedOptimize || startTouched) && startAddress.trim().length === 0
      ? "Starting point is required."
      : undefined;

  const endFieldError =
    (hasAttemptedOptimize || endTouched) && endAddress.trim().length === 0
      ? "Ending point is required."
      : undefined;

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    void optimizeRoute({
      startAddress,
      endAddress,
      destinationAddresses,
      canOptimize,
    });
  };

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
            value={endAddress}
            onChange={setEndAddress}
            onBlur={() => setEndTouched(true)}
            helperText="Type at least 3 characters to see suggestions."
            errorText={endFieldError}
            required
          />

          <AddressAutocompleteInput
            id="destinationAddressAutocomplete"
            label="Add destination with autocomplete"
            placeholder="Type destination and press Enter or click Add destination"
            value={destinationDraft}
            onChange={setDestinationDraft}
            onEnterKey={() => addDestinationAddress(destinationDraft)}
            onSuggestionSelect={addDestinationAddress}
            helperText="Pick a suggestion, then press Enter or click Add destination."
          />

          <div className={responsiveStyles.actionRow}>
            <div className={responsiveStyles.actionButtons}>
              <button
                type="button"
                onClick={() => setDestinationDraft("")}
                disabled={!destinationDraft.trim()}
                className={responsiveStyles.secondaryButton}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => addDestinationAddress(destinationDraft)}
                disabled={!destinationDraft.trim()}
                className={responsiveStyles.primaryButton}
              >
                Add destination
              </button>
            </div>
          </div>

          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Destination addresses (one per line, optional)
          </label>
          <div className={responsiveStyles.destinationList}>
            {destinationAddresses.length === 0 ? (
              <p className="m-0 text-sm text-slate-400 dark:text-slate-500">
                No destinations added yet.
              </p>
            ) : (
              <ol className="m-0 space-y-2">
                {destinationAddresses.map((address, index) => (
                  <li
                    key={`${address}-${index}`}
                    className={responsiveStyles.destinationItem}
                  >
                    <div className={responsiveStyles.destinationItemBody}>
                      <span className="min-w-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {index + 1}.
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {address}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDestinationAddress(index)}
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
              {addressCount} destination(s) detected
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
