import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type {
  DashboardAlert,
  DashboardSummaryResponse,
  DashboardTrendPoint,
  OptimizeRouteV2ScheduleWarning,
  OptimizeRouteV2UnscheduledTask,
} from "../../../../shared/contracts";
import { getDb } from "../../db";
import { routeOptimizationRuns, routeOptimizationTasks } from "../../db/schema";
import type { OptimizeRouteResultV2 } from "../../app/api/optimize-route/v2/types";
import type { ValidatedOptimizeRouteV2Request } from "../../app/api/optimize-route/v2/validation";

const DAY_MS = 24 * 60 * 60 * 1000;

type PersistOptimizationRunInput = {
  nurseId: string;
  endpointVersion: "v2" | "v3";
  requestId?: string;
  request: ValidatedOptimizeRouteV2Request;
  result: OptimizeRouteResultV2;
};

const runInTransaction = async <T>(operation: (db: ReturnType<typeof getDb>) => Promise<T>) => {
  const db = getDb();
  const transactionalDb = db as unknown as {
    transaction?: (fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  if (typeof transactionalDb.transaction === "function") {
    return transactionalDb.transaction((transaction) =>
      operation(transaction as ReturnType<typeof getDb>),
    );
  }

  return operation(db);
};

const toNonNegativeInt = (value: number) => {
  if (!isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

const roundToOneDecimal = (value: number) => {
  if (!isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
};

const formatDateInTimeZone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format date in timezone.");
  }

  return `${year}-${month}-${day}`;
};

const parseWarnings = (value: unknown): OptimizeRouteV2ScheduleWarning[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is OptimizeRouteV2ScheduleWarning => {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    return typeof (item as Record<string, unknown>).message === "string";
  });
};

const toAlertLevel = (warning: OptimizeRouteV2ScheduleWarning): DashboardAlert["level"] => {
  if (
    warning.type === "fixed_late" ||
    warning.type === "window_conflict" ||
    warning.type === "outside_working_hours"
  ) {
    return "at_risk";
  }

  if (warning.type === "lunch_skipped") {
    return "heads_up";
  }

  return "at_risk";
};

const toRouteLabel = (runId: string) => `R-${runId.slice(0, 4).toUpperCase()}`;

const buildDateRange = (now: Date, timezone: string) => {
  const dates: string[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    dates.push(formatDateInTimeZone(new Date(now.getTime() - offset * DAY_MS), timezone));
  }

  return dates;
};

const resolveUpcomingStops = ({
  latestRunId,
  latestRunTimezone,
  tasks,
  now,
}: {
  latestRunId: string;
  latestRunTimezone: string;
  tasks: Array<typeof routeOptimizationTasks.$inferSelect>;
  now: Date;
}) => {
  const scheduled = tasks
    .filter((task) => task.isUnscheduled === false && task.serviceStartTime instanceof Date)
    .sort((left, right) => {
      const leftStart = left.serviceStartTime instanceof Date ? left.serviceStartTime.getTime() : 0;
      const rightStart =
        right.serviceStartTime instanceof Date ? right.serviceStartTime.getTime() : 0;
      return leftStart - rightStart;
    });

  if (scheduled.length === 0) {
    return [];
  }

  const nowMs = now.getTime();
  const upcoming = scheduled.filter((task) => {
    if (!(task.serviceEndTime instanceof Date)) {
      return true;
    }

    return task.serviceEndTime.getTime() >= nowMs;
  });

  const source = upcoming.length > 0 ? upcoming : scheduled;
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: latestRunTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return source.slice(0, 4).map((task) => ({
    time: timeFormatter.format(task.serviceStartTime as Date),
    route: toRouteLabel(latestRunId),
    destination: task.address,
    status: (task.onTime === false ? "at_risk" : "on_track") as DashboardUpcomingStop["status"],
  }));
};

const buildTrend = (
  dateRange: string[],
  recentRuns: Array<typeof routeOptimizationRuns.$inferSelect>,
): DashboardTrendPoint[] => {
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

  return dateRange.map((date) => {
    const runsForDay = recentRuns.filter((run) => run.planningDate === date);
    const scheduled = runsForDay.reduce((total, run) => total + run.scheduledVisitCount, 0);
    const onTime = runsForDay.reduce((total, run) => total + run.onTimeVisitCount, 0);
    const onTimeRate = scheduled > 0 ? Math.round((onTime / scheduled) * 100) : 0;

    return {
      date,
      label: weekdayFormatter.format(new Date(`${date}T12:00:00.000Z`)),
      onTimeRatePercent: onTimeRate,
    };
  });
};

const buildAlerts = ({
  latestRun,
  latestRunWarnings,
}: {
  latestRun: typeof routeOptimizationRuns.$inferSelect | null;
  latestRunWarnings: OptimizeRouteV2ScheduleWarning[];
}): DashboardAlert[] => {
  if (!latestRun) {
    return [
      {
        title: "No route history yet",
        detail: "Run route optimization to unlock live alerts and trend tracking.",
        level: "heads_up",
      },
    ];
  }

  const alerts: DashboardAlert[] = [];

  if (latestRun.unscheduledVisitCount > 0) {
    alerts.push({
      title: "Unscheduled visits",
      detail: `${latestRun.unscheduledVisitCount} visit${latestRun.unscheduledVisitCount === 1 ? "" : "s"} could not be scheduled in the latest plan.`,
      level: "action_needed",
    });
  }

  latestRunWarnings.slice(0, 3).forEach((warning) => {
    alerts.push({
      title: warning.type === "window_conflict" ? "Visit window conflict" : "Route warning",
      detail: warning.message,
      level: toAlertLevel(warning),
    });
  });

  return alerts.slice(0, 3);
};

export const recordOptimizationRun = async ({
  nurseId,
  endpointVersion,
  requestId,
  request,
  result,
}: PersistOptimizationRunInput): Promise<void> => {
  await runInTransaction(async (tx) => {
    const scheduledTasks = result.orderedStops.flatMap((stop) => stop.tasks);
    const onTimeVisitCount = scheduledTasks.filter((task) => task.onTime).length;

    const [createdRun] = await tx
      .insert(routeOptimizationRuns)
      .values({
        nurseId,
        planningDate: request.planningDate,
        timezone: request.timezone,
        endpointVersion,
        optimizerVersion: endpointVersion,
        algorithmVersion: result.algorithmVersion,
        optimizationObjective: request.optimizationObjective,
        preserveOrder: request.preserveOrder === true,
        requestedVisitCount: request.visits.length,
        scheduledVisitCount: scheduledTasks.length,
        onTimeVisitCount,
        unscheduledVisitCount: result.unscheduledTasks.length,
        fixedWindowViolations: toNonNegativeInt(result.metrics.fixedWindowViolations),
        totalLateSeconds: toNonNegativeInt(result.metrics.totalLateSeconds),
        totalWaitSeconds: toNonNegativeInt(result.metrics.totalWaitSeconds),
        totalDistanceMeters: toNonNegativeInt(result.metrics.totalDistanceMeters),
        totalDurationSeconds: toNonNegativeInt(result.metrics.totalDurationSeconds),
        warnings: result.warnings ?? [],
        requestId: requestId ?? null,
      })
      .returning({ id: routeOptimizationRuns.id });

    if (!createdRun) {
      return;
    }

    const visitsById = new Map(request.visits.map((visit) => [visit.visitId, visit]));

    const scheduledRows = result.orderedStops.flatMap((stop) =>
      stop.tasks.map((task) => ({
        runId: createdRun.id,
        nurseId,
        visitId: task.visitId,
        patientId: task.patientId,
        patientName: task.patientName,
        address: task.address,
        windowStart: task.windowStart,
        windowEnd: task.windowEnd,
        windowType: task.windowType,
        arrivalTime: task.arrivalTime ? new Date(task.arrivalTime) : null,
        serviceStartTime: task.serviceStartTime ? new Date(task.serviceStartTime) : null,
        serviceEndTime: task.serviceEndTime ? new Date(task.serviceEndTime) : null,
        waitSeconds: toNonNegativeInt(task.waitSeconds),
        lateBySeconds: toNonNegativeInt(task.lateBySeconds),
        onTime: task.onTime,
        isUnscheduled: false,
        unscheduledReason: null,
      })),
    );

    const unscheduledRows = result.unscheduledTasks.map((task: OptimizeRouteV2UnscheduledTask) => {
      const sourceVisit = visitsById.get(task.visitId);

      return {
        runId: createdRun.id,
        nurseId,
        visitId: task.visitId,
        patientId: task.patientId,
        patientName: sourceVisit?.patientName ?? task.patientId,
        address: sourceVisit?.address ?? "Unknown",
        windowStart: sourceVisit?.windowStart ?? "00:00",
        windowEnd: sourceVisit?.windowEnd ?? "23:59",
        windowType: sourceVisit?.windowType ?? "flexible",
        arrivalTime: null,
        serviceStartTime: null,
        serviceEndTime: null,
        waitSeconds: null,
        lateBySeconds: null,
        onTime: null,
        isUnscheduled: true,
        unscheduledReason: task.reason,
      };
    });

    const rows = [...scheduledRows, ...unscheduledRows];
    if (rows.length > 0) {
      await tx.insert(routeOptimizationTasks).values(rows);
    }
  });
};

export const getDashboardSummaryForNurse = async ({
  nurseId,
  timezone,
  now = new Date(),
}: {
  nurseId: string;
  timezone: string;
  now?: Date;
}): Promise<DashboardSummaryResponse> => {
  const dateRange = buildDateRange(now, timezone);
  const startDate = dateRange[0];
  const endDate = dateRange[dateRange.length - 1];

  const recentRuns = await getDb()
    .select()
    .from(routeOptimizationRuns)
    .where(
      and(
        eq(routeOptimizationRuns.nurseId, nurseId),
        gte(routeOptimizationRuns.planningDate, startDate),
        lte(routeOptimizationRuns.planningDate, endDate),
      ),
    )
    .orderBy(desc(routeOptimizationRuns.createdAt));

  let latestRun = recentRuns[0] ?? null;
  if (!latestRun) {
    const [fallbackLatest] = await getDb()
      .select()
      .from(routeOptimizationRuns)
      .where(eq(routeOptimizationRuns.nurseId, nurseId))
      .orderBy(desc(routeOptimizationRuns.createdAt))
      .limit(1);

    latestRun = fallbackLatest ?? null;
  }

  const latestRunWarnings = parseWarnings(latestRun?.warnings ?? []);
  const latestRunTasks = latestRun
    ? await getDb()
        .select()
        .from(routeOptimizationTasks)
        .where(eq(routeOptimizationTasks.runId, latestRun.id))
        .orderBy(
          asc(routeOptimizationTasks.serviceStartTime),
          asc(routeOptimizationTasks.createdAt),
        )
    : [];

  const today = dateRange[dateRange.length - 1];
  const todayRuns = recentRuns.filter((run) => run.planningDate === today);

  const scheduledVisitsToday = todayRuns.reduce((total, run) => total + run.scheduledVisitCount, 0);
  const unscheduledVisitsToday = todayRuns.reduce(
    (total, run) => total + run.unscheduledVisitCount,
    0,
  );
  const totalDurationTodaySeconds = todayRuns.reduce(
    (total, run) => total + run.totalDurationSeconds,
    0,
  );
  const totalDistanceTodayMeters = todayRuns.reduce(
    (total, run) => total + run.totalDistanceMeters,
    0,
  );

  const scheduledVisits7d = recentRuns.reduce((total, run) => total + run.scheduledVisitCount, 0);
  const onTimeVisits7d = recentRuns.reduce((total, run) => total + run.onTimeVisitCount, 0);
  const onTimeRatePercent7d =
    scheduledVisits7d > 0 ? Math.round((onTimeVisits7d / scheduledVisits7d) * 100) : null;

  const delayedRoutes = todayRuns.filter(
    (run) =>
      run.fixedWindowViolations > 0 || run.totalLateSeconds > 0 || run.unscheduledVisitCount > 0,
  ).length;

  return {
    asOf: now.toISOString(),
    timezone,
    kpis: {
      routesToday: todayRuns.length,
      visitsScheduledToday: scheduledVisitsToday,
      onTimeRatePercent7d,
      unscheduledVisitsToday,
      driveHoursToday: roundToOneDecimal(totalDurationTodaySeconds / 3600),
    },
    alerts: buildAlerts({ latestRun, latestRunWarnings }),
    upcomingStops:
      latestRun && latestRunTasks.length > 0
        ? resolveUpcomingStops({
            latestRunId: latestRun.id,
            latestRunTimezone: latestRun.timezone,
            tasks: latestRunTasks,
            now,
          })
        : [],
    trend: buildTrend(dateRange, recentRuns),
    snapshot: {
      completedRoutes: todayRuns.length,
      delayedRoutes,
      unscheduledVisits: unscheduledVisitsToday,
      totalDistanceKm: roundToOneDecimal(totalDistanceTodayMeters / 1000),
    },
  };
};
