import type { OrderedStop } from "../types";
import { formatDuration } from "./routePlannerUtils";
import {
  expectedStartTimeFormatter,
  formatExpectedStartTimeText,
  formatVisitDurationMinutes,
} from "./routePlannerResultUtils";
import { formatNameWords } from "../patients/patientName";

type TaskResult = OrderedStop["tasks"][number];

type OptimizedStopCardProps = {
  task: TaskResult;
  stop: OrderedStop;
  stopLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  isStale?: boolean;
  showMoveControls?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

// Status system:
//   Blue  → selection / active (expanded card)
//   Green → success / on-time  (chip only)
//   Red   → error / late       (chip only)
//   No left-border coloring — status lives in the chip, not the container

export function OptimizedStopCard({
  task,
  stop,
  stopLabel,
  isExpanded,
  onToggle,
  isStale = false,
  showMoveControls = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: OptimizedStopCardProps) {
  const formattedPatientName = formatNameWords(task.patientName);
  const expectedStartLabel = formatExpectedStartTimeText(
    task.serviceStartTime,
    isStale,
  );
  const expectedStartTimeValue = expectedStartLabel
    .replace("Expected start time ", "")
    .replace(/^~\s+/, "");

  const status = (() => {
    if (!task.windowStart) {
      return {
        chipClass:
          "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
        label: "Open window",
      };
    }
    if (task.lateBySeconds > 0) {
      return {
        chipClass:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
        label: "Late",
      };
    }
    return {
      chipClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
      label: "On time",
    };
  })();

  const visitDurationLabel = formatVisitDurationMinutes(task.serviceDurationMinutes);

  // Active (expanded) card uses blue highlight; collapsed is neutral white
  const cardClass = isExpanded
    ? "border-blue-200 bg-blue-50/50 dark:border-blue-700/60 dark:bg-blue-950/20"
    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40";

  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border px-3 py-2.5 shadow-sm transition-colors ${cardClass}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          aria-label={`Toggle details for ${formattedPatientName}`}
          aria-expanded={isExpanded}
          onClick={onToggle}
          className={`m-0 flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg bg-transparent p-0.5 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-slate-800/40 ${
            showMoveControls ? "pr-7" : ""
          }`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              aria-hidden="true"
              data-testid={`details-chevron-${task.visitId}`}
              data-expanded={isExpanded ? "true" : "false"}
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-transform duration-200 dark:text-slate-500 ${isExpanded ? "rotate-90" : "rotate-0"}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M7.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <span
              className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100"
              title={formattedPatientName}
            >
              {stopLabel}. {formattedPatientName}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-semibold uppercase tracking-[0.1em] ${status.chipClass}`}
            >
              {status.label}
            </span>
          </span>
        </button>
      </div>

      {showMoveControls && (
        <div className="absolute right-2 top-2 flex w-6 shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            aria-label={`Move ${formattedPatientName} up`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
              canMoveUp
                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                : "cursor-not-allowed text-slate-300 dark:text-slate-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`Move ${formattedPatientName} down`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
              canMoveDown
                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                : "cursor-not-allowed text-slate-300 dark:text-slate-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {expectedStartLabel && (
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-1${showMoveControls ? " pr-9" : ""}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Expected start</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {isStale ? "~\u00A0" : ""}{expectedStartTimeValue}
            </span>
          </div>
          {isStale && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
              Estimated
            </span>
          )}
        </div>
      )}

      <div className="mt-1 grid gap-y-0 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {(task.windowStart && task.windowEnd) || visitDurationLabel ? (
          <span className="min-w-0 text-slate-500 dark:text-slate-400">
            {task.windowStart && task.windowEnd
              ? `Window: ${task.windowStart} – ${task.windowEnd}`
              : ""}
            {task.windowStart && task.windowEnd && visitDurationLabel ? " | " : ""}
            {visitDurationLabel ? `${visitDurationLabel} visit` : ""}
          </span>
        ) : null}
      </div>

      {task.windowStart && task.windowEnd && task.lateBySeconds > 0 && (
        <p
          className={[
            "mt-0.5 text-xs font-semibold",
            task.windowType === "fixed" && task.lateBySeconds > 15 * 60
              ? "text-red-600 dark:text-red-400"
              : task.windowType === "flexible" && task.lateBySeconds > 60 * 60
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400",
          ].join(" ")}
        >
          Outside preferred window by {Math.ceil(task.lateBySeconds / 60)} min
        </p>
      )}

      {isExpanded && (
        <div className="mt-2.5 grid gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="grid gap-1.5 text-xs">
            <div className="flex gap-2">
              <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Address</span>
              <span className="min-w-0 text-slate-700 dark:text-slate-300">{task.address}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Visit type</span>
              <span className="text-slate-700 dark:text-slate-300 capitalize">{task.windowType}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Duration</span>
              <span className="text-slate-700 dark:text-slate-300">{formatVisitDurationMinutes(task.serviceDurationMinutes)}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Travel</span>
              <span className="text-slate-700 dark:text-slate-300">
                {stop.distanceFromPreviousKm} km · {formatDuration(stop.durationFromPreviousSeconds)} from prev stop
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type EndingStopCardProps = {
  stop: OrderedStop;
  stopLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  isHomeEndingPoint: boolean;
  isStale?: boolean;
};

export function EndingStopCard({
  stop,
  stopLabel: _stopLabel,
  isExpanded,
  onToggle,
  isHomeEndingPoint,
  isStale = false,
}: EndingStopCardProps) {
  return (
    // Visually differentiated from patient stops: dashed border + slate-50 bg
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        Final Stop
      </p>
      <button
        type="button"
        aria-label={`Toggle details for ${isHomeEndingPoint ? "Home ending point" : "Ending point"}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="m-0 flex w-full items-center justify-between gap-3 bg-transparent p-0 text-left underline-offset-2 hover:underline"
      >
        <span
          className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
          title={isHomeEndingPoint ? "Home" : stop.address}
        >
          {isHomeEndingPoint ? "Home" : stop.address}
        </span>
        {!isHomeEndingPoint && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            End
          </span>
        )}
      </button>

      {isHomeEndingPoint && (() => {
        const arrivalDate = new Date(stop.arrivalTime);
        if (arrivalDate.getTime() !== arrivalDate.getTime()) return null;
        return (
          <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700 dark:text-emerald-300">
            {isStale ? "~\u00A0" : ""}You should be home by{" "}
            {expectedStartTimeFormatter.format(arrivalDate)}
          </p>
        );
      })()}

      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {stop.distanceFromPreviousKm} km · {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
      </p>

      {isExpanded && (
        <div className="mt-2 grid gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/40">
          {isHomeEndingPoint && (
            <div className="flex gap-2">
              <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Address</span>
              <span className="text-slate-700 dark:text-slate-300">{stop.address}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-slate-400 dark:text-slate-500">Type</span>
            <span className="text-slate-700 dark:text-slate-300">Ending point</span>
          </div>
        </div>
      )}
    </div>
  );
}
