import { useMemo } from "react";
import type { OptimizeRouteResponse } from "../types";
import { responsiveStyles } from "../responsiveStyles";
import RouteMap from "../RouteMap";
import { formatDuration, buildGoogleMapsTripUrl } from "./routePlannerUtils";
import { formatNameWords } from "../patients/patientName";
import { OptimizedStopList } from "./OptimizedStopList";

const unscheduledReasonLabels = {
  fixed_window_unreachable: "Cannot be reached before the fixed window ends.",
  invalid_window: "The visit window is invalid.",
  duration_exceeds_window: "Service duration is longer than the window.",
  insufficient_day_capacity: "Not enough day capacity for this visit.",
} as const;

const compactDisplayCopy = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]{18,}/g, (segment) => `${segment.slice(0, 12)}...`);

type OptimizedRouteResultProps = {
  result: OptimizeRouteResponse;
  conflictWarningsDismissed: boolean;
  onDismissConflictWarnings: () => void;
  latenessWarningsDismissed: boolean;
  onDismissLatenessWarnings: () => void;
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  normalizedHomeAddress: string;
};

export function OptimizedRouteResult({
  result,
  conflictWarningsDismissed,
  onDismissConflictWarnings,
  latenessWarningsDismissed,
  onDismissLatenessWarnings,
  expandedResultTaskIds,
  onToggleResultTask,
  expandedResultEndingStopIds,
  onToggleResultEndingStop,
  normalizedHomeAddress,
}: OptimizedRouteResultProps) {
  const googleMapsTripUrl = useMemo(
    () => buildGoogleMapsTripUrl(result),
    [result],
  );
  const scheduledStopCount = useMemo(
    () =>
      result.orderedStops.filter(
        (stop) => !stop.isEndingPoint && stop.tasks.length > 0,
      ).length,
    [result],
  );

  const hasIntermediateStops = useMemo(
    () => result.orderedStops.some((stop) => !stop.isEndingPoint),
    [result],
  );

  const makeDismissButton = (onDismiss: () => void) => (
    <button
      type="button"
      aria-label="Dismiss warning"
      onClick={onDismiss}
      className="shrink-0 text-current opacity-60 hover:opacity-100"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 2l10 10M12 2L2 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  const warningsSection =
    result.warnings && result.warnings.length > 0
      ? (() => {
          const conflictWarnings = result.warnings.filter(
            (w) => w.type === "window_conflict",
          );
          const latenessWarnings = result.warnings.filter(
            (w) => w.type !== "window_conflict",
          );
          return (
            <section className="mt-5 grid gap-3 lg:grid-cols-2">
              {conflictWarnings.length > 0 && !conflictWarningsDismissed && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        Exceptions
                      </p>
                      <p className="m-0 mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Scheduling{" "}
                        {conflictWarnings.length === 1
                          ? "Conflict"
                          : "Conflicts"}
                      </p>
                    </div>
                    {makeDismissButton(onDismissConflictWarnings)}
                  </div>
                  <ul className="m-0 mt-2 space-y-2 pl-0">
                    {conflictWarnings.map((warning) => (
                      <li
                        key={
                          warning.type === "window_conflict"
                            ? `window_conflict:${warning.patientIds[0]}:${warning.patientIds[1]}`
                            : `${warning.type}:${warning.patientId}`
                        }
                        className="list-none rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2 text-xs leading-5 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"
                        title={warning.message}
                      >
                        {compactDisplayCopy(warning.message)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {latenessWarnings.length > 0 && !latenessWarningsDismissed && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm dark:border-red-900/70 dark:bg-red-950/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
                        Timing risk
                      </p>
                      <p className="m-0 mt-1 text-sm font-semibold text-red-900 dark:text-red-100">
                        Lateness{" "}
                        {latenessWarnings.length === 1 ? "Warning" : "Warnings"}
                      </p>
                    </div>
                    {makeDismissButton(onDismissLatenessWarnings)}
                  </div>
                  <ul className="m-0 mt-2 space-y-2 pl-0">
                    {latenessWarnings.map((warning) => (
                      <li
                        key={
                          warning.type === "window_conflict"
                            ? `window_conflict:${warning.patientIds[0]}:${warning.patientIds[1]}`
                            : `${warning.type}:${warning.patientId}`
                        }
                        className="list-none rounded-xl border border-red-200/80 bg-white/70 px-3 py-2 text-xs leading-5 text-red-900 shadow-sm dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100"
                        title={warning.message}
                      >
                        {compactDisplayCopy(warning.message)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })()
      : null;

  return (
    <section className={`mt-4 ${responsiveStyles.surfaceCard}`}>
      <div className="grid gap-2">
        <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className={responsiveStyles.resultHeader}>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                Dispatch Plan
              </p>
              <h2 className="m-0 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Optimized Route
              </h2>
              <p className="m-0 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Review the route timeline, verify timing risk, and use the map
                as a spatial check before heading out.
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  Open in Google Maps
                </a>
                <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 lg:justify-end">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Live traffic may affect ETAs.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className={responsiveStyles.resultStatCard}>
              <p className={responsiveStyles.resultStatLabel}>Driving Time</p>
              <p className={responsiveStyles.resultStatValue}>
                {formatDuration(result.metrics.totalDurationSeconds)}
              </p>
              <p className={responsiveStyles.resultStatMeta}>
                Total driving time, excludes traffic
              </p>
            </div>
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
                Scheduled Stops
              </p>
              <p className={responsiveStyles.resultStatValue}>
                {scheduledStopCount}
              </p>
              <p className={responsiveStyles.resultStatMeta}>
                {result.unscheduledTasks.length > 0
                  ? `${result.unscheduledTasks.length} unscheduled visit${result.unscheduledTasks.length === 1 ? "" : "s"}`
                  : "All visits currently scheduled"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="order-2 min-w-0 sm:order-1">
          <section className="rounded-[28px] bg-slate-50/80 p-4 dark:bg-slate-950/35">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Route timeline
                </p>
                <h3 className="m-0 mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  Scheduled visits in driving order
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {scheduledStopCount} stop{scheduledStopCount === 1 ? "" : "s"}
              </span>
            </div>

            {hasIntermediateStops ? (
              <OptimizedStopList
                orderedStops={result.orderedStops}
                expandedResultTaskIds={expandedResultTaskIds}
                onToggleResultTask={onToggleResultTask}
                expandedResultEndingStopIds={expandedResultEndingStopIds}
                onToggleResultEndingStop={onToggleResultEndingStop}
                normalizedHomeAddress={normalizedHomeAddress}
              />
            ) : (
              <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                No scheduled visits are available for the current optimized
                route.
              </p>
            )}
          </section>
        </div>

        <div className="order-1 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-[28px] bg-slate-50/80 p-4 dark:bg-slate-950/35">
            <div className="mb-1">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Map overview
              </p>
              <h3 className="m-0 mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                Spatial route check
              </h3>
            </div>
            <RouteMap
              start={result.start}
              orderedStops={result.orderedStops}
              routeLegs={result.routeLegs}
            />
          </section>
        </div>
      </div>

      {warningsSection}

      {result.unscheduledTasks.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Exceptions
          </p>
          <h3 className="m-0 mt-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
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
                  {task.patientName
                    ? compactDisplayCopy(formatNameWords(task.patientName))
                    : task.patientId}
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
  );
}
