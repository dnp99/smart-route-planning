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
        borderClass: "",
        chipClass:
          "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        label: "Open window",
      };
    }
    if (task.lateBySeconds > 0) {
      return {
        borderClass: "border-l-4 border-l-red-500",
        chipClass:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
        label: "Late",
      };
    }
    return {
      borderClass: "border-l-4 border-l-emerald-500",
      chipClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
      label: "On time",
    };
  })();

  const visitDurationLabel = formatVisitDurationMinutes(task.serviceDurationMinutes);

  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40${status.borderClass ? ` ${status.borderClass}` : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          aria-label={`Toggle details for ${formattedPatientName}`}
          aria-expanded={isExpanded}
          onClick={onToggle}
          className={`m-0 flex w-full min-w-0 cursor-pointer items-start justify-between gap-2 rounded-lg bg-transparent p-0.5 text-left transition-colors underline-offset-2 hover:bg-slate-50/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-slate-800/40 ${
            showMoveControls ? "pr-7" : ""
          }`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-0.5">
            <span
              aria-hidden="true"
              data-testid={`details-chevron-${task.visitId}`}
              data-expanded={isExpanded ? "true" : "false"}
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-900 transition-transform duration-200 dark:text-slate-100 ${isExpanded ? "rotate-90" : "rotate-0"}`}
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
              className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[1.03rem] font-semibold leading-6 text-slate-900 dark:text-slate-100"
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
        <div className="absolute right-2.5 top-1.5 flex w-6 shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            aria-label={`Move ${formattedPatientName} up`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-sm font-semibold leading-none transition ${
              canMoveUp
                ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
            }`}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`Move ${formattedPatientName} down`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-sm font-semibold leading-none transition ${
              canMoveDown
                ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
            }`}
          >
            ▼
          </button>
        </div>
      )}

      {expectedStartLabel && (
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1">
          <p className="m-0 text-sm font-semibold leading-5 text-emerald-700 dark:text-emerald-300">
            Expected start time {isStale ? "~ " : ""}
            {expectedStartTimeValue}
          </p>
          {isStale && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
              Estimated
            </span>
          )}
        </div>
      )}

      <div className="mt-0.5 grid gap-y-0 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
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
        <div className="mt-1.5 grid gap-1 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          <p className="m-0">Address: {task.address}</p>
          <p className="m-0">Visit type: {task.windowType}</p>
          <p className="m-0">
            Duration: {formatVisitDurationMinutes(task.serviceDurationMinutes)}
          </p>
          <p className="m-0">
            Travel from previous stop: {stop.distanceFromPreviousKm} km •{" "}
            {formatDuration(stop.durationFromPreviousSeconds)}
          </p>
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
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <button
        type="button"
        aria-label={`Toggle details for ${isHomeEndingPoint ? "Home ending point" : "Ending point"}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="m-0 flex w-full items-start justify-between gap-3 bg-transparent p-0 text-left underline-offset-2 hover:underline"
      >
        <span
          className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-slate-100"
          title={isHomeEndingPoint ? "Home" : stop.address}
        >
          {isHomeEndingPoint ? "Home" : stop.address}
        </span>
        {!isHomeEndingPoint && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            End
          </span>
        )}
      </button>

      {isHomeEndingPoint && (() => {
        const arrivalDate = new Date(stop.arrivalTime);
        if (arrivalDate.getTime() !== arrivalDate.getTime()) return null;
        return (
          <p className="mt-1.5 text-[1.03rem] font-semibold leading-6 text-emerald-700 dark:text-emerald-300">
            {isStale ? "~ " : ""}You should be home by{" "}
            {expectedStartTimeFormatter.format(arrivalDate)}
          </p>
        );
      })()}

      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {stop.distanceFromPreviousKm} km •{" "}
        {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
      </p>

      {isExpanded && (
        <div className="mt-1.5 grid gap-1 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          {isHomeEndingPoint && (
            <p className="m-0">Address: {stop.address}</p>
          )}
          <p className="m-0">Ending Point.</p>
        </div>
      )}
    </div>
  );
}
