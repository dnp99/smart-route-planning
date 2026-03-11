import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AdminDebugPanel from "./AdminDebugPanel";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import RouteMap from "./RouteMap";
import { responsiveStyles } from "./responsiveStyles";
import ThemeToggle from "./ThemeToggle";
import type { OptimizeRouteResponse, Theme } from "./types";

type OptimizeRouteErrorResponse = {
  error?: string;
};

const formatDuration = (durationSeconds: number) => {
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
};

const buildGoogleMapsTripUrl = (result: OptimizeRouteResponse) => {
  const baseUrl = new URL("https://www.google.com/maps/dir/");
  baseUrl.searchParams.set("api", "1");
  baseUrl.searchParams.set("travelmode", "driving");
  baseUrl.searchParams.set("origin", result.start.address);
  baseUrl.searchParams.set("destination", result.end.address);

  const waypointAddresses = result.orderedStops
    .filter((stop) => !stop.isEndingPoint)
    .map((stop) => stop.address);

  if (waypointAddresses.length > 0) {
    baseUrl.searchParams.set("waypoints", waypointAddresses.join("|"));
  }

  return baseUrl.toString();
};

const isOptimizeRouteResponse = (
  payload: unknown,
): payload is OptimizeRouteResponse => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const maybePayload = payload as Partial<OptimizeRouteResponse>;
  return (
    typeof maybePayload.totalDistanceKm === "number" &&
    typeof maybePayload.totalDistanceMeters === "number" &&
    typeof maybePayload.totalDurationSeconds === "number" &&
    typeof maybePayload.start?.address === "string" &&
    typeof maybePayload.end?.address === "string" &&
    Array.isArray(maybePayload.orderedStops) &&
    Array.isArray(maybePayload.routeLegs)
  );
};

const extractOptimizeRouteErrorMessage = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const maybePayload = payload as OptimizeRouteErrorResponse;
  return typeof maybePayload.error === "string" ? maybePayload.error : null;
};

const resolveInitialTheme = (): Theme => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "dark";
};

function RoutePlanner() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  const [startAddress, setStartAddress] = useState(
    "3361 Ingram Road, Mississauga, ON",
  );
  const [endAddress, setEndAddress] = useState("");
  const [addressesText, setAddressesText] = useState("");
  const [destinationDraft, setDestinationDraft] = useState("");
  const [result, setResult] = useState<OptimizeRouteResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);
  const [hasAttemptedOptimize, setHasAttemptedOptimize] = useState(false);
  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!showOptimizeSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowOptimizeSuccess(false);
    }, 750);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showOptimizeSuccess]);

  const addressCount = useMemo(() => {
    return addressesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, [addressesText]);

  const destinationAddresses = useMemo(() => {
    return addressesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [addressesText]);

  const addDestinationAddress = (address: string) => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      return;
    }

    setAddressesText((currentText) => {
      const existingAddresses = currentText
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean);

      if (existingAddresses.indexOf(trimmedAddress.toLowerCase()) !== -1) {
        return currentText;
      }

      if (!currentText.trim()) {
        return trimmedAddress;
      }

      return `${currentText.replace(/\s+$/, "")}\n${trimmedAddress}`;
    });

    setDestinationDraft("");
  };

  const removeDestinationAddress = (indexToRemove: number) => {
    setAddressesText((currentText) =>
      currentText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((_, index) => index !== indexToRemove)
        .join("\n"),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setHasAttemptedOptimize(true);

    if (!canOptimize) {
      return;
    }

    setIsLoading(true);

    const addresses = destinationAddresses;

    const apiBaseUrl = resolveApiBaseUrl();

    fetch(`${apiBaseUrl}/api/optimize-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startAddress,
        endAddress,
        addresses,
      }),
    })
      .then((response) =>
        response.json().then((payload) => ({
          response,
          payload,
        })),
      )
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(
            extractOptimizeRouteErrorMessage(payload) ??
              "Unable to optimize route.",
          );
        }

        if (!isOptimizeRouteResponse(payload)) {
          throw new Error("Unexpected API response format.");
        }

        setResult(payload);
        setShowOptimizeSuccess(true);
      })
      .catch((apiError) => {
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Something went wrong.",
        );
      })
      .then(() => {
        setIsLoading(false);
      });
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

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

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">
              Smart Route Planner
            </h1>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <button
                type="button"
                onClick={() => setIsDebugPanelOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Open debug analytics panel"
                title="Open debug analytics panel"
              >
                <span aria-hidden="true">⌘</span>
              </button>
            </div>
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

      <AdminDebugPanel
        isOpen={isDebugPanelOpen}
        onClose={() => setIsDebugPanelOpen(false)}
      />
    </main>
  );
}

export default RoutePlanner;
