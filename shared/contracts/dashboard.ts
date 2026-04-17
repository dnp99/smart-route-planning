const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type DashboardAlert = {
  title: string;
  detail: string;
  level: "action_needed" | "at_risk" | "heads_up";
};

export type DashboardUpcomingStop = {
  time: string;
  route: string;
  patientName?: string | null;
  destination: string;
  status: "on_track" | "at_risk" | "pending";
};

export type DashboardTrendPoint = {
  date: string;
  label: string;
  onTimeRatePercent: number;
};

export type DashboardSummaryResponse = {
  asOf: string;
  timezone: string;
  kpis: {
    routesToday: number;
    visitsScheduledToday: number;
    onTimeRatePercent7d: number | null;
    unscheduledVisitsToday: number;
    driveHoursToday: number;
  };
  alerts: DashboardAlert[];
  upcomingStops: DashboardUpcomingStop[];
  trend: DashboardTrendPoint[];
  snapshot: {
    completedRoutes: number;
    delayedRoutes: number;
    unscheduledVisits: number;
    totalDistanceKm: number;
  };
};

const isAlertLevel = (value: unknown): value is DashboardAlert["level"] =>
  value === "action_needed" || value === "at_risk" || value === "heads_up";

const isStopStatus = (value: unknown): value is DashboardUpcomingStop["status"] =>
  value === "on_track" || value === "at_risk" || value === "pending";

const isAlert = (value: unknown): value is DashboardAlert =>
  isObject(value) &&
  typeof value.title === "string" &&
  typeof value.detail === "string" &&
  isAlertLevel(value.level);

const isUpcomingStop = (value: unknown): value is DashboardUpcomingStop =>
  isObject(value) &&
  typeof value.time === "string" &&
  typeof value.route === "string" &&
  (value.patientName === undefined || value.patientName === null || typeof value.patientName === "string") &&
  typeof value.destination === "string" &&
  isStopStatus(value.status);

const isTrendPoint = (value: unknown): value is DashboardTrendPoint =>
  isObject(value) &&
  typeof value.date === "string" &&
  typeof value.label === "string" &&
  typeof value.onTimeRatePercent === "number";

export const isDashboardSummaryResponse = (value: unknown): value is DashboardSummaryResponse => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.asOf !== "string" ||
    typeof value.timezone !== "string" ||
    !isObject(value.kpis) ||
    typeof value.kpis.routesToday !== "number" ||
    typeof value.kpis.visitsScheduledToday !== "number" ||
    (value.kpis.onTimeRatePercent7d !== null &&
      typeof value.kpis.onTimeRatePercent7d !== "number") ||
    typeof value.kpis.unscheduledVisitsToday !== "number" ||
    typeof value.kpis.driveHoursToday !== "number" ||
    !Array.isArray(value.alerts) ||
    !value.alerts.every(isAlert) ||
    !Array.isArray(value.upcomingStops) ||
    !value.upcomingStops.every(isUpcomingStop) ||
    !Array.isArray(value.trend) ||
    !value.trend.every(isTrendPoint) ||
    !isObject(value.snapshot) ||
    typeof value.snapshot.completedRoutes !== "number" ||
    typeof value.snapshot.delayedRoutes !== "number" ||
    typeof value.snapshot.unscheduledVisits !== "number" ||
    typeof value.snapshot.totalDistanceKm !== "number"
  ) {
    return false;
  }

  return true;
};

export const parseDashboardSummaryResponse = (value: unknown): DashboardSummaryResponse | null =>
  isDashboardSummaryResponse(value) ? value : null;
