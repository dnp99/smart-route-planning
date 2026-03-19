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
  const googleMapsTripUrl = useMemo(() => buildGoogleMapsTripUrl(result), [result]);

  const hasIntermediateStops = useMemo(
    () => result.orderedStops.some((stop) => !stop.isEndingPoint),
    [result],
  );

  const leaveBySuggestion = useMemo(() => {
    const firstScheduledStop = result.orderedStops.find(
      (stop) => !stop.isEndingPoint && stop.tasks.length > 0,
    );
    if (!firstScheduledStop) return null;

    const [firstTask] = firstScheduledStop.tasks;
    if (!firstTask) return null;

    const firstTaskStartMs = new Date(firstTask.serviceStartTime).getTime();
    if (firstTaskStartMs !== firstTaskStartMs) return null;

    const startLeg = result.routeLegs.find(
      (leg) => leg.fromStopId === "start" && leg.toStopId === firstScheduledStop.stopId,
    );
    const travelSecondsFromStart =
      startLeg?.durationSeconds ?? firstScheduledStop.durationFromPreviousSeconds;
    const leaveByMs = firstTaskStartMs - Math.max(0, travelSecondsFromStart) * 1000;
    if (leaveByMs !== leaveByMs) return null;

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
    };
  }, [result]);

  const makeDismissButton = (onDismiss: () => void) => (
    <button
      type="button"
      aria-label="Dismiss warning"
      onClick={onDismiss}
      className="shrink-0 text-current opacity-60 hover:opacity-100"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );

  return (
    <section className={`mt-4 ${responsiveStyles.surfaceCard}`}>
      <div className={responsiveStyles.resultHeader}>
        <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Optimized Route
        </h2>
        <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
          Your optimized stops and estimated times are shown below.
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
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Open in Google Maps
          </a>
          <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Live traffic may affect ETAs.
          </p>
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
          <p className={responsiveStyles.resultStatLabel}>Driving Time</p>
          <p className={responsiveStyles.resultStatValue}>
            {formatDuration(result.metrics.totalDurationSeconds)}
          </p>
          <p className={responsiveStyles.resultStatMeta}>
            Total driving time, excludes traffic
          </p>
        </div>
      </div>

      {leaveBySuggestion && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="m-0 font-semibold">Suggested leave-by: {leaveBySuggestion.label}</p>
          <p className="m-0 text-xs text-emerald-700 dark:text-emerald-300">
            Based on a {leaveBySuggestion.travelDurationLabel} drive to your first visit.
          </p>
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (() => {
        const conflictWarnings = result.warnings.filter((w) => w.type === "window_conflict");
        const latenessWarnings = result.warnings.filter((w) => w.type !== "window_conflict");
        return (
          <div className="mt-3 space-y-2">
            {conflictWarnings.length > 0 && !conflictWarningsDismissed && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Scheduling {conflictWarnings.length === 1 ? "Conflict" : "Conflicts"}
                  </p>
                  {makeDismissButton(onDismissConflictWarnings)}
                </div>
                <ul className="m-0 mt-1 space-y-0.5 pl-4">
                  {conflictWarnings.map((warning) => (
                    <li
                      key={warning.type === "window_conflict" ? `window_conflict:${warning.patientIds[0]}:${warning.patientIds[1]}` : `${warning.type}:${warning.patientId}`}
                      className="text-xs text-amber-700 dark:text-amber-300"
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {latenessWarnings.length > 0 && !latenessWarningsDismissed && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/70 dark:bg-red-950/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-red-800 dark:text-red-200">
                    Lateness {latenessWarnings.length === 1 ? "Warning" : "Warnings"}
                  </p>
                  {makeDismissButton(onDismissLatenessWarnings)}
                </div>
                <ul className="m-0 mt-1 space-y-0.5 pl-4">
                  {latenessWarnings.map((warning) => (
                    <li
                      key={warning.type === "window_conflict" ? `window_conflict:${warning.patientIds[0]}:${warning.patientIds[1]}` : `${warning.type}:${warning.patientId}`}
                      className="text-xs text-red-700 dark:text-red-300"
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      <hr className="my-4 border-slate-300 dark:border-slate-600" />

      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[2fr_3fr]">
        <div className="order-2 min-w-0 sm:order-1">
          {hasIntermediateStops && (
            <OptimizedStopList
              orderedStops={result.orderedStops}
              expandedResultTaskIds={expandedResultTaskIds}
              onToggleResultTask={onToggleResultTask}
              expandedResultEndingStopIds={expandedResultEndingStopIds}
              onToggleResultEndingStop={onToggleResultEndingStop}
              normalizedHomeAddress={normalizedHomeAddress}
            />
          )}
        </div>

        <div className="order-1 sm:order-2 sm:sticky sm:top-4 sm:self-start">
          <RouteMap
            start={result.start}
            orderedStops={result.orderedStops}
            routeLegs={result.routeLegs}
          />
        </div>
      </div>

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
              <li key={task.visitId} className="text-sm text-amber-900 dark:text-amber-200">
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
  );
}
