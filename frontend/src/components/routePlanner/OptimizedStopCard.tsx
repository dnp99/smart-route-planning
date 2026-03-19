import type { OrderedStop } from "../types";
import { formatDuration } from "./routePlannerUtils";
import {
  expectedStartTimeFormatter,
  formatExpectedStartTimeText,
  formatVisitDurationMinutes,
  timeToMinutes,
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
    if (task.onTime && task.windowEnd) {
      const serviceStartDate = new Date(task.serviceStartTime);
      const serviceStartMinutes =
        serviceStartDate.getHours() * 60 + serviceStartDate.getMinutes();
      const windowEndMinutes = timeToMinutes(task.windowEnd);
      if (windowEndMinutes - serviceStartMinutes < 30) {
        return {
          borderClass: "border-l-4 border-l-amber-400",
          chipClass:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
          label: "Tight window",
        };
      }
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
      className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40${status.borderClass ? ` ${status.borderClass}` : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={`Toggle details for ${formattedPatientName}`}
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="m-0 flex w-full min-w-0 items-start justify-between gap-3 bg-transparent p-0 text-left underline-offset-2 hover:underline"
        >
          <span
            className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-slate-900 dark:text-slate-100"
            title={formattedPatientName}
          >
            {stopLabel}. {formattedPatientName}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.chipClass}`}
          >
            {status.label}
          </span>
        </button>
        {showMoveControls && (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              aria-label={`Move ${formattedPatientName} up`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
              className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Move ${formattedPatientName} down`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
              className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ▼
            </button>
          </div>
        )}
      </div>

      {expectedStartLabel && (
        <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {expectedStartLabel}
        </p>
      )}

      <div className="mt-1 grid gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {task.windowStart && task.windowEnd && (
          <span className="min-w-0">
            Window: {task.windowStart} – {task.windowEnd}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {stop.distanceFromPreviousKm} km • {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
          </span>
          {visitDurationLabel && <span>{visitDurationLabel} visit</span>}
        </div>
      </div>

      {task.windowStart && task.windowEnd && task.lateBySeconds > 0 && (
        <p
          className={[
            "mt-1 text-xs font-semibold",
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
        <div className="mt-2 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          <p className="m-0">Address: {task.address}</p>
          <p className="m-0">Visit type: {task.windowType}</p>
          <p className="m-0">
            Duration: {formatVisitDurationMinutes(task.serviceDurationMinutes)}
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
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
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
          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            End
          </span>
        )}
      </button>

      {isHomeEndingPoint && (() => {
        const arrivalDate = new Date(stop.arrivalTime);
        if (arrivalDate.getTime() !== arrivalDate.getTime()) return null;
        return (
          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {isStale ? "~ " : ""}You should be home by{" "}
            {expectedStartTimeFormatter.format(arrivalDate)}
          </p>
        );
      })()}

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {stop.distanceFromPreviousKm} km •{" "}
        {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
      </p>

      {isExpanded && (
        <div className="mt-2 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          {isHomeEndingPoint && (
            <p className="m-0">Address: {stop.address}</p>
          )}
          <p className="m-0">Ending Point.</p>
        </div>
      )}
    </div>
  );
}
