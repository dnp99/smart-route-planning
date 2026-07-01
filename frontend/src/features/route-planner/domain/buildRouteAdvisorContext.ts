import type {
  DeidentifiedRouteContext,
  RouteAdvisorWarning,
} from "../../../../../shared/contracts";
import type { OptimizeRouteResponse } from "../types";
import { createRouteTimeFormatter } from "../utils/routePlannerResultUtils";

// The ONE PHI boundary. Turns a full optimize response (which carries patient
// names + addresses) into a de-identified, aggregate-only context. Nothing that
// leaves this function may contain a name, address, or patient id — stops are
// labelled "Stop N" by position, warnings keep only their type + minute counts.

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const resolveWeekday = (planningDate: string): string => {
  const [year, month, day] = planningDate.split("-").map(Number);
  if (year !== year || month !== month || day !== day) {
    return "";
  }
  // Date-only, evaluated in UTC so the weekday never shifts with the device zone.
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const roundMinutes = (seconds: number): number => Math.round(seconds / 60);

const formatInstant = (value: string, formatter: Intl.DateTimeFormat): string | undefined => {
  const parsed = new Date(value);
  return parsed.getTime() === parsed.getTime() ? formatter.format(parsed) : undefined;
};

const deidentifyWarning = (
  warning: NonNullable<OptimizeRouteResponse["warnings"]>[number],
): RouteAdvisorWarning => {
  if (warning.type === "fixed_late" || warning.type === "flexible_late") {
    return { type: warning.type, lateMinutes: warning.lateMinutes };
  }
  if (warning.type === "outside_working_hours") {
    return { type: warning.type, overByMinutes: warning.overByMinutes };
  }
  // window_conflict / lunch_skipped carry no minute count — type alone is enough.
  return { type: warning.type };
};

export const buildRouteAdvisorContext = (
  result: OptimizeRouteResponse,
  planningDate: string,
): DeidentifiedRouteContext => {
  const timezone = result.timezone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = createRouteTimeFormatter(result.timezone);

  const scheduledStops = result.orderedStops.filter(
    (stop) => !stop.isEndingPoint && stop.tasks.length > 0,
  );

  const stops = scheduledStops.map((stop, position) => {
    const lateMinutes = stop.tasks.reduce(
      (max, task) => Math.max(max, roundMinutes(task.lateBySeconds)),
      0,
    );
    return {
      index: position + 1,
      windowType: stop.tasks[0]?.windowType,
      onTime: stop.tasks.every((task) => task.onTime),
      ...(lateMinutes > 0 ? { lateMinutes } : {}),
    };
  });

  const visitCount = scheduledStops.reduce((total, stop) => total + stop.tasks.length, 0);

  const unscheduledByReason: Record<string, number> = {};
  for (const task of result.unscheduledTasks) {
    unscheduledByReason[task.reason] = (unscheduledByReason[task.reason] ?? 0) + 1;
  }

  // Last scheduled stop's final service-end is the day's finish.
  const lastStop = scheduledStops[scheduledStops.length - 1];
  const lastTask = lastStop?.tasks[lastStop.tasks.length - 1];
  const finishTime = lastTask ? formatInstant(lastTask.serviceEndTime, formatter) : undefined;
  const leaveByTime = formatInstant(result.start.departureTime, formatter);

  return {
    planningWeekday: resolveWeekday(planningDate),
    timezone,
    stopCount: scheduledStops.length,
    visitCount,
    ...(finishTime ? { finishTime } : {}),
    ...(leaveByTime ? { leaveByTime } : {}),
    metrics: {
      distanceKm: result.metrics.totalDistanceKm,
      durationMinutes: roundMinutes(result.metrics.totalDurationSeconds),
      lateMinutes: roundMinutes(result.metrics.totalLateSeconds),
      waitMinutes: roundMinutes(result.metrics.totalWaitSeconds),
      fixedWindowViolations: result.metrics.fixedWindowViolations,
    },
    warnings: (result.warnings ?? []).map(deidentifyWarning),
    unscheduledByReason,
    stops,
  };
};
