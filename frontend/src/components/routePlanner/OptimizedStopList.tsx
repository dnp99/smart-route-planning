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
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  normalizedHomeAddress: string;
};

export function OptimizedStopList({
  orderedStops,
  expandedResultTaskIds,
  onToggleResultTask,
  expandedResultEndingStopIds,
  onToggleResultEndingStop,
  normalizedHomeAddress,
}: OptimizedStopListProps) {
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
        const showBreakCard = idleGapMinutes >= BREAK_GAP_THRESHOLD_MINUTES;

        return (
          <Fragment key={stop.stopId}>
            {showBreakCard && (
              <div className="flex items-center gap-3 py-1.5">
                <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  >
                    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                    <line x1="6" y1="2" x2="6" y2="4" />
                    <line x1="10" y1="2" x2="10" y2="4" />
                    <line x1="14" y1="2" x2="14" y2="4" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Break · {formatBreakGap(idleGapMinutes)}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {expectedStartTimeFormatter.format(new Date(breakStartMs))} –{" "}
                      {expectedStartTimeFormatter.format(new Date(breakEndMs))}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <li className="min-w-0">
              {stop.tasks.length > 0 ? (
                <div className="space-y-2">
                  {stop.tasks.map((task) => {
                    const detailsKey = `${task.visitId}`;
                    return (
                      <OptimizedStopCard
                        key={task.visitId}
                        task={task}
                        stop={stop}
                        stopLabel={String(stopIndex + 1)}
                        isExpanded={Boolean(expandedResultTaskIds[detailsKey])}
                        onToggle={() => onToggleResultTask(detailsKey)}
                      />
                    );
                  })}
                </div>
              ) : (
                <>
                  {stop.isEndingPoint ? (
                    (() => {
                      const endingDetailsKey = `ending:${stop.stopId}`;
                      const isHomeEndingPoint = addressesMatch(
                        stop.address,
                        normalizedHomeAddress,
                      );
                      return (
                        <EndingStopCard
                          stop={stop}
                          stopLabel="E"
                          isExpanded={Boolean(expandedResultEndingStopIds[endingDetailsKey])}
                          onToggle={() => onToggleResultEndingStop(endingDetailsKey)}
                          isHomeEndingPoint={isHomeEndingPoint}
                        />
                      );
                    })()
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
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
