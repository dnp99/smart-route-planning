const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// ── De-identified route context (browser → advisor route → Claude) ────────────
// Deliberately PHI-free: aggregates, warning types, and stops labelled by index
// only. No patient names or addresses ever cross this boundary.

export type RouteAdvisorWarningType =
  | "fixed_late"
  | "flexible_late"
  | "window_conflict"
  | "outside_working_hours"
  | "lunch_skipped";

export type RouteAdvisorWarning = {
  type: RouteAdvisorWarningType;
  lateMinutes?: number;
  overByMinutes?: number;
};

export type RouteAdvisorStop = {
  index: number; // 1-based "Stop N"
  windowType?: "fixed" | "flexible";
  onTime: boolean;
  lateMinutes?: number;
};

export type DeidentifiedRouteContext = {
  planningWeekday: string; // e.g. "Wednesday"
  timezone: string;
  stopCount: number;
  visitCount: number;
  finishTime?: string; // formatted in the route timezone, e.g. "02:11 PM"
  leaveByTime?: string;
  metrics: {
    distanceKm: number;
    durationMinutes: number;
    lateMinutes: number;
    waitMinutes: number;
    fixedWindowViolations: number;
  };
  warnings: RouteAdvisorWarning[];
  unscheduledByReason: Record<string, number>;
  stops: RouteAdvisorStop[];
};

export type RouteAdvisorResponse = {
  brief: string;
  suggestions: string[];
};

const WARNING_TYPES: readonly RouteAdvisorWarningType[] = [
  "fixed_late",
  "flexible_late",
  "window_conflict",
  "outside_working_hours",
  "lunch_skipped",
];

const isWarning = (value: unknown): value is RouteAdvisorWarning =>
  isObject(value) &&
  typeof value.type === "string" &&
  WARNING_TYPES.indexOf(value.type as RouteAdvisorWarningType) !== -1;

const isStop = (value: unknown): value is RouteAdvisorStop =>
  isObject(value) && isFiniteNumber(value.index) && typeof value.onTime === "boolean";

const isMetrics = (value: unknown): value is DeidentifiedRouteContext["metrics"] =>
  isObject(value) &&
  isFiniteNumber(value.distanceKm) &&
  isFiniteNumber(value.durationMinutes) &&
  isFiniteNumber(value.lateMinutes) &&
  isFiniteNumber(value.waitMinutes) &&
  isFiniteNumber(value.fixedWindowViolations);

// Server-side guard for the request body — keep it strict so nothing unexpected
// (or PHI-shaped) reaches the model.
export const isDeidentifiedRouteContext = (
  value: unknown,
): value is DeidentifiedRouteContext => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.planningWeekday !== "string" ||
    typeof value.timezone !== "string" ||
    !isFiniteNumber(value.stopCount) ||
    !isFiniteNumber(value.visitCount) ||
    !isMetrics(value.metrics) ||
    !isObject(value.unscheduledByReason)
  ) {
    return false;
  }

  if (value.finishTime !== undefined && typeof value.finishTime !== "string") {
    return false;
  }
  if (value.leaveByTime !== undefined && typeof value.leaveByTime !== "string") {
    return false;
  }

  if (!Array.isArray(value.warnings) || value.warnings.some((w) => !isWarning(w))) {
    return false;
  }
  if (!Array.isArray(value.stops) || value.stops.some((s) => !isStop(s))) {
    return false;
  }

  return Object.values(value.unscheduledByReason).every(isFiniteNumber);
};

// Client-side parse of the advisor response.
export const parseRouteAdvisorResponse = (value: unknown): RouteAdvisorResponse | null => {
  if (!isObject(value) || typeof value.brief !== "string" || !Array.isArray(value.suggestions)) {
    return null;
  }
  if (value.suggestions.some((item) => typeof item !== "string")) {
    return null;
  }
  return { brief: value.brief, suggestions: value.suggestions as string[] };
};
