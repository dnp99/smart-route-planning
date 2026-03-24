import { Fragment } from "react";
import type { OrderedStop } from "../types";
import { OptimizedStopCard, EndingStopCard } from "./OptimizedStopCard";
import {
  BREAK_GAP_THRESHOLD_MINUTES,
  expectedStartTimeFormatter,
  formatBreakGap,
  addressesMatch,
} from "./routePlannerResultUtils";
import { formatDuration } from "./routePlannerUtils";

type OptimizedStopListProps = {
  orderedStops: OrderedStop[];
  isStale?: boolean;
  onMoveStop?: (stopId: string, direction: "up" | "down") => void;
  canMoveStop?: (stopId: string, direction: "up" | "down") => boolean;
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  normalizedHomeAddress: string;
  breakGapThresholdMinutes?: number;
  workStart?: string;
  workEnd?: string;
  lunchStartTime?: string;
  lunchDurationMinutes?: number;
};

function isLunchBreak(
  breakStartMs: number,
  breakDurationMinutes: number,
  lunchStartTime?: string,
  lunchDurationMinutes?: number,
): boolean {
  if (!lunchStartTime || !lunchDurationMinutes) return false;
  // Duration must match configured lunch (±1 min tolerance)
  if (Math.abs(breakDurationMinutes - lunchDurationMinutes) > 1) return false;
  // Break must start within ±90 minutes of configured lunch start
  const [lh, lm] = lunchStartTime.split(":").map(Number);
  const lunchStartMin = lh * 60 + lm;
  const d = new Date(breakStartMs);
  const breakMin = d.getHours() * 60 + d.getMinutes();
  return Math.abs(breakMin - lunchStartMin) <= 90;
}

export function OptimizedStopList({
  orderedStops,
  isStale = false,
  onMoveStop,
  canMoveStop,
  expandedResultTaskIds,
  onToggleResultTask,
  expandedResultEndingStopIds,
  onToggleResultEndingStop,
  normalizedHomeAddress,
  breakGapThresholdMinutes,
  workStart,
  workEnd,
  lunchStartTime,
  lunchDurationMinutes,
}: OptimizedStopListProps) {
  const effectiveBreakGapThreshold = breakGapThresholdMinutes ?? BREAK_GAP_THRESHOLD_MINUTES;
  // Pre-compute a sequential label per task (1, 2, 3…) across all stops,
  // so multi-task stops don't repeat the same stop number.
  const taskLabels = new Map<string, number>();
  let taskCounter = 0;
  orderedStops.forEach((stop) => {
    stop.tasks.forEach((task) => {
      taskCounter += 1;
      taskLabels.set(task.visitId, taskCounter);
    });
  });

  return (
    <ol className="mb-0 mt-3 list-none space-y-3 p-0">
      {orderedStops.map((stop, stopIndex) => {
        const prevStop = stopIndex > 0 ? orderedStops[stopIndex - 1] : null;
        let idleGapMinutes = 0;
        let breakStartMs = 0;
        let breakEndMs = 0;
        if (prevStop && !stop.isEndingPoint && stop.tasks.length > 0) {
          const prevDepartureMs = new Date(prevStop.departureTime).getTime();
          const nextServiceStartMs = new Date(stop.tasks[0].serviceStartTime).getTime();
          const travelMs = stop.durationFromPreviousSeconds * 1000;
          idleGapMinutes = (nextServiceStartMs - prevDepartureMs - travelMs) / 60000;
          breakStartMs = prevDepartureMs;
          breakEndMs = nextServiceStartMs - travelMs;
        }
        const showBreakCard = idleGapMinutes >= effectiveBreakGapThreshold;
        const isLunch =
          showBreakCard &&
          isLunchBreak(breakStartMs, idleGapMinutes, lunchStartTime, lunchDurationMinutes);

        return (
          <Fragment key={stop.stopId}>
            {showBreakCard && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-2 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
                  {isLunch ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                      aria-hidden="true"
                    >
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                      <line x1="7" y1="2" x2="7" y2="11" />
                      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                      aria-hidden="true"
                    >
                      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                      <line x1="6" y1="2" x2="6" y2="4" />
                      <line x1="10" y1="2" x2="10" y2="4" />
                      <line x1="14" y1="2" x2="14" y2="4" />
                    </svg>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      {isLunch ? "Lunch" : "Break"} · {formatBreakGap(idleGapMinutes)}
                    </span>
                    <span className="text-xs text-blue-700/90 dark:text-blue-300/90">
                      {isStale ? "~ " : ""}
                      {expectedStartTimeFormatter.format(new Date(breakStartMs))} –{" "}
                      {expectedStartTimeFormatter.format(new Date(breakEndMs))}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <li className="min-w-0">
              {stop.tasks.length > 0 ? (
                <div className="space-y-1.5">
                  {stop.tasks.map((task, taskIndex) => {
                    const detailsKey = `${task.visitId}`;

                    let interTaskBreakMinutes = 0;
                    let interTaskBreakStartMs = 0;
                    let interTaskBreakEndMs = 0;
                    if (taskIndex > 0) {
                      const prevTask = stop.tasks[taskIndex - 1];
                      interTaskBreakStartMs = new Date(prevTask.serviceEndTime).getTime();
                      interTaskBreakEndMs = new Date(task.serviceStartTime).getTime();
                      interTaskBreakMinutes = (interTaskBreakEndMs - interTaskBreakStartMs) / 60000;
                    }
                    const showInterTaskBreak = interTaskBreakMinutes >= effectiveBreakGapThreshold;
                    const isInterTaskLunch =
                      showInterTaskBreak &&
                      isLunchBreak(
                        interTaskBreakStartMs,
                        interTaskBreakMinutes,
                        lunchStartTime,
                        lunchDurationMinutes,
                      );

                    return (
                      <Fragment key={task.visitId}>
                        {showInterTaskBreak && (
                          <div className="flex items-center gap-3 py-1">
                            <div className="flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-2 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
                              {isInterTaskLunch ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                                  aria-hidden="true"
                                >
                                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                                  <line x1="7" y1="2" x2="7" y2="11" />
                                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                                  aria-hidden="true"
                                >
                                  <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                                  <line x1="6" y1="2" x2="6" y2="4" />
                                  <line x1="10" y1="2" x2="10" y2="4" />
                                  <line x1="14" y1="2" x2="14" y2="4" />
                                </svg>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                  {isInterTaskLunch ? "Lunch" : "Break"} ·{" "}
                                  {formatBreakGap(interTaskBreakMinutes)}
                                </span>
                                <span className="text-xs text-blue-700/90 dark:text-blue-300/90">
                                  {isStale ? "~ " : ""}
                                  {expectedStartTimeFormatter.format(
                                    new Date(interTaskBreakStartMs),
                                  )}{" "}
                                  –{" "}
                                  {expectedStartTimeFormatter.format(new Date(interTaskBreakEndMs))}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        <OptimizedStopCard
                          task={task}
                          stop={stop}
                          stopLabel={String(taskLabels.get(task.visitId) ?? stopIndex + 1)}
                          isStale={isStale}
                          showMoveControls={taskIndex === 0}
                          canMoveUp={
                            taskIndex === 0 &&
                            typeof canMoveStop === "function" &&
                            canMoveStop(stop.stopId, "up")
                          }
                          canMoveDown={
                            taskIndex === 0 &&
                            typeof canMoveStop === "function" &&
                            canMoveStop(stop.stopId, "down")
                          }
                          onMoveUp={() => onMoveStop?.(stop.stopId, "up")}
                          onMoveDown={() => onMoveStop?.(stop.stopId, "down")}
                          isExpanded={Boolean(expandedResultTaskIds[detailsKey])}
                          onToggle={() => onToggleResultTask(detailsKey)}
                          workStart={workStart}
                          workEnd={workEnd}
                        />
                      </Fragment>
                    );
                  })}
                </div>
              ) : (
                <>
                  {stop.isEndingPoint ? (
                    (() => {
                      const endingDetailsKey = `ending:${stop.stopId}`;
                      const isHomeEndingPoint = addressesMatch(stop.address, normalizedHomeAddress);
                      return (
                        <EndingStopCard
                          stop={stop}
                          stopLabel="E"
                          isStale={isStale}
                          isExpanded={Boolean(expandedResultEndingStopIds[endingDetailsKey])}
                          onToggle={() => onToggleResultEndingStop(endingDetailsKey)}
                          isHomeEndingPoint={isHomeEndingPoint}
                        />
                      );
                    })()
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                      <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {stopIndex + 1}. {stop.address}
                      </p>
                      <small className="mt-1 block text-xs font-medium text-blue-600 dark:text-blue-300">
                        No scheduled visit tasks at this stop.
                      </small>
                      <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        {stop.distanceFromPreviousKm} km •{" "}
                        {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
                      </small>
                    </div>
                  )}
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
