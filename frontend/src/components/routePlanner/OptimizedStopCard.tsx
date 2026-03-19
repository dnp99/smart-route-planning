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
  isExpanded: boolean;
  onToggle: () => void;
};

export function OptimizedStopCard({
  task,
  stop,
  isExpanded,
  onToggle,
}: OptimizedStopCardProps) {
  const formattedPatientName = formatNameWords(task.patientName);
  const expectedStartLabel = formatExpectedStartTimeText(task.serviceStartTime);

  const stopBorderClass = (() => {
    if (!task.windowStart) return "";
    if (task.lateBySeconds > 0) return "border-l-2 border-l-red-500";
    if (task.onTime && task.windowEnd) {
      const serviceStartDate = new Date(task.serviceStartTime);
      const serviceEndMinutes =
        serviceStartDate.getHours() * 60 +
        serviceStartDate.getMinutes() +
        task.serviceDurationMinutes;
      const windowEndMinutes = timeToMinutes(task.windowEnd);
      if (windowEndMinutes - serviceEndMinutes < 30) {
        return "border-l-2 border-l-amber-400";
      }
    }
    return "border-l-2 border-l-emerald-500";
  })();

  const visitDurationLabel = formatVisitDurationMinutes(task.serviceDurationMinutes);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900/40${stopBorderClass ? ` ${stopBorderClass}` : ""}`}
    >
      <button
        type="button"
        aria-label={`Toggle details for ${formattedPatientName}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="m-0 bg-transparent p-0 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
      >
        {formattedPatientName}
      </button>

      {expectedStartLabel && (
        <p className="m-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {expectedStartLabel}
        </p>
      )}

      {task.windowStart && task.windowEnd && (
        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
          Window: {task.windowStart} – {task.windowEnd}
        </p>
      )}

      {task.windowStart && task.windowEnd && task.lateBySeconds > 0 && (
        <p
          className={[
            "m-0 text-xs font-semibold",
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
        <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
          <p className="m-0">Address: {task.address}</p>
          <p className="m-0">
            Preferred window:{" "}
            {task.windowStart && task.windowEnd
              ? `${task.windowStart} - ${task.windowEnd}`
              : "No preferred window"}
          </p>
          <p className="m-0">Visit type: {task.windowType}</p>
          <p className="m-0">
            Duration: {formatVisitDurationMinutes(task.serviceDurationMinutes)}
          </p>
        </div>
      )}

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {stop.distanceFromPreviousKm} km •{" "}
        {formatDuration(stop.durationFromPreviousSeconds)} from previous
        stop{visitDurationLabel ? ` • ${visitDurationLabel} visit` : ""}
      </p>
    </div>
  );
}

type EndingStopCardProps = {
  stop: OrderedStop;
  isExpanded: boolean;
  onToggle: () => void;
  isHomeEndingPoint: boolean;
};

export function EndingStopCard({
  stop,
  isExpanded,
  onToggle,
  isHomeEndingPoint,
}: EndingStopCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900/40">
      <button
        type="button"
        aria-label={`Toggle details for ${isHomeEndingPoint ? "Home ending point" : "Ending point"}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="m-0 bg-transparent p-0 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
      >
        {isHomeEndingPoint ? "Home" : stop.address}
      </button>

      {isHomeEndingPoint && (() => {
        const arrivalDate = new Date(stop.arrivalTime);
        if (arrivalDate.getTime() !== arrivalDate.getTime()) return null;
        return (
          <p className="m-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            You should be home by {expectedStartTimeFormatter.format(arrivalDate)}
          </p>
        );
      })()}

      {isExpanded && (
        <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
          {isHomeEndingPoint && (
            <p className="m-0">Address: {stop.address}</p>
          )}
          <p className="m-0">Ending Point.</p>
        </div>
      )}

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {stop.distanceFromPreviousKm} km •{" "}
        {formatDuration(stop.durationFromPreviousSeconds)} from previous stop
      </p>
    </div>
  );
}
