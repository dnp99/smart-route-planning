import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  DashboardAlert,
  DashboardSummaryResponse,
  DashboardTrendPoint,
  DashboardUpcomingStop,
  OptimizeRouteV2ScheduleWarning,
  OptimizeRouteV2UnscheduledTask,
} from "../../../../shared/contracts";
import { getDb } from "../../db";
import {
  patients,
  recurringVisitTemplates,
  routeOptimizationRuns,
  routeOptimizationTasks,
} from "../../db/schema";
import type { VisitInstanceMeta } from "../recurrence/recurrenceRepository";
import type { OptimizeRouteResultV2 } from "../../app/api/optimize-route/v2/types";
import type { ValidatedOptimizeRouteV2Request } from "../../app/api/optimize-route/v2/validation";

const DAY_MS = 24 * 60 * 60 * 1000;

type PersistOptimizationRunInput = {
  nurseId: string;
  endpointVersion: "v2" | "v3";
  requestId?: string;
  request: ValidatedOptimizeRouteV2Request;
  result: OptimizeRouteResultV2;
  instanceMetaByVisitId?: Map<string, VisitInstanceMeta>;
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

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const buildBusiestDays = async (nurseId: string) => {
  const rows = await getDb()
    .select({
      dayOfWeek: sql<number>`extract(dow from ${routeOptimizationRuns.planningDate}::date)::int`,
      avgVisits: sql<number>`round(avg(${routeOptimizationRuns.scheduledVisitCount})::numeric, 1)::float`,
      totalRuns: sql<number>`count(*)::int`,
    })
    .from(routeOptimizationRuns)
    .where(eq(routeOptimizationRuns.nurseId, nurseId))
    .groupBy(sql`extract(dow from ${routeOptimizationRuns.planningDate}::date)`)
    .orderBy(sql`extract(dow from ${routeOptimizationRuns.planningDate}::date)`);

  return rows.map((row) => ({
    dayLabel: DOW_LABELS[row.dayOfWeek] ?? "Unknown",
    avgVisits: row.avgVisits ?? 0,
    totalRuns: row.totalRuns ?? 0,
  }));
};

const buildPatientRisks = async (nurseId: string, since: string) => {
  const taskStats = await getDb()
    .select({
      patientId: routeOptimizationTasks.patientId,
      totalAppearances: sql<number>`count(*)::int`,
      unscheduledCount: sql<number>`count(*) filter (where ${routeOptimizationTasks.isUnscheduled} = true)::int`,
      lateCount: sql<number>`count(*) filter (where ${routeOptimizationTasks.onTime} = false and ${routeOptimizationTasks.isUnscheduled} = false)::int`,
    })
    .from(routeOptimizationTasks)
    .innerJoin(routeOptimizationRuns, eq(routeOptimizationTasks.runId, routeOptimizationRuns.id))
    .where(
      and(
        eq(routeOptimizationTasks.nurseId, nurseId),
        gte(routeOptimizationRuns.planningDate, since),
      ),
    )
    .groupBy(routeOptimizationTasks.patientId)
    .having(
      sql`count(*) filter (where ${routeOptimizationTasks.isUnscheduled} = true) > 0 or count(*) filter (where ${routeOptimizationTasks.onTime} = false and ${routeOptimizationTasks.isUnscheduled} = false) > 0`,
    )
    .orderBy(
      desc(sql`count(*) filter (where ${routeOptimizationTasks.isUnscheduled} = true)`),
      desc(
        sql`count(*) filter (where ${routeOptimizationTasks.onTime} = false and ${routeOptimizationTasks.isUnscheduled} = false)`,
      ),
    )
    .limit(5);

  if (taskStats.length === 0) return [];

  const patientIds = taskStats.map((s) => s.patientId);
  const patientRecords = await getDb()
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(eq(patients.nurseId, nurseId), inArray(patients.id, patientIds)));

  return taskStats.flatMap((stat) => {
    const patient = patientRecords.find((p) => p.id === stat.patientId);
    if (!patient) return [];
    return [
      {
        patientId: stat.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        unscheduledCount: stat.unscheduledCount,
        lateCount: stat.lateCount,
        totalAppearances: stat.totalAppearances,
      },
    ];
  });
};

const buildDateRange = (now: Date, timezone: string) => {
  const dates: string[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    dates.push(formatDateInTimeZone(new Date(now.getTime() - offset * DAY_MS), timezone));
  }

  return dates;
};

const isMissingTaskLinkColumnsError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause as
    | { code?: unknown; message?: unknown }
    | undefined;
  const code = typeof cause?.code === "string" ? cause.code : null;
  const message = `${error.message} ${typeof cause?.message === "string" ? cause.message : ""}`;

  return (
    code === "42703" &&
    (message.indexOf("visit_instance_id") >= 0 || message.indexOf("template_id") >= 0)
  );
};

const resolveUpcomingStops = ({
  latestRunId,
  latestRunTimezone,
  tasks,
  templateNameById,
  now,
}: {
  latestRunId: string;
  latestRunTimezone: string;
  tasks: Array<typeof routeOptimizationTasks.$inferSelect>;
  templateNameById: Map<string, string>;
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

  return source.slice(0, 4).map((task, index) => ({
    time: timeFormatter.format(task.serviceStartTime as Date),
    route: toRouteLabel(latestRunId),
    patientName: null,
    destination: `Stop ${index + 1}`,
    status: (task.onTime === false ? "at_risk" : "on_track") as DashboardUpcomingStop["status"],
    templateId: task.templateId ?? null,
    templateName: task.templateId ? (templateNameById.get(task.templateId) ?? null) : null,
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
  hasRecentRuns,
}: {
  latestRun: typeof routeOptimizationRuns.$inferSelect | null;
  latestRunWarnings: OptimizeRouteV2ScheduleWarning[];
  hasRecentRuns: boolean;
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

  if (!hasRecentRuns) {
    return [
      {
        title: "No routes in the last 7 days",
        detail: `Latest saved plan was for ${latestRun.planningDate}. Plan a route to refresh this dashboard.`,
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

const scrubRequestPayload = (
  request: ValidatedOptimizeRouteV2Request,
): Record<string, unknown> => ({
  ...request,
  visits: request.visits.map(({ patientName: _pn, address: _addr, ...rest }) => rest),
});

const scrubResultPayload = (result: OptimizeRouteResultV2): Record<string, unknown> => ({
  ...result,
  orderedStops: result.orderedStops.map((stop) => ({
    ...stop,
    tasks: stop.tasks.map(({ patientName: _pn, address: _addr, ...rest }) => rest),
  })),
  unscheduledTasks: result.unscheduledTasks.map((task) => {
    if ("patientName" in task) {
      const { patientName: _pn, ...rest } = task as typeof task & { patientName: string };
      return rest;
    }
    if ("patientNames" in task) {
      const { patientNames: _pns, ...rest } = task as typeof task & { patientNames: string[] };
      return rest;
    }
    return task;
  }),
});

export const recordOptimizationRun = async ({
  nurseId,
  endpointVersion,
  requestId,
  request,
  result,
  instanceMetaByVisitId,
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
        requestPayload: scrubRequestPayload(request),
        resultPayload: scrubResultPayload(result),
        requestId: requestId ?? null,
      })
      .returning({ id: routeOptimizationRuns.id });

    if (!createdRun) {
      return;
    }

    const scheduledPatientIds = [...new Set(request.visits.map((visit) => visit.patientId))].filter(
      (patientId): patientId is string => typeof patientId === "string" && patientId.length > 0,
    );

    if (scheduledPatientIds.length > 0) {
      const txWithUpdate = tx as ReturnType<typeof getDb> & {
        update?: ReturnType<typeof getDb>["update"];
      };

      if (typeof txWithUpdate.update === "function") {
        await txWithUpdate
          .update(patients)
          .set({
            isActive: true,
            lastScheduledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(patients.nurseId, nurseId), inArray(patients.id, scheduledPatientIds)));
      }
    }

    const visitsById = new Map(request.visits.map((visit) => [visit.visitId, visit]));

    const resolveInstanceLink = (visitId: string) => {
      const meta = instanceMetaByVisitId?.get(visitId);
      return {
        visitInstanceId: meta?.instanceId ?? null,
        templateId: meta?.templateId ?? null,
      };
    };

    const scheduledRows = result.orderedStops.flatMap((stop) =>
      stop.tasks.map((task) => ({
        runId: createdRun.id,
        nurseId,
        visitId: task.visitId,
        ...resolveInstanceLink(task.visitId),
        patientId: task.patientId,
        patientName: null,
        address: null,
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
        ...resolveInstanceLink(task.visitId),
        patientId: task.patientId,
        patientName: null,
        address: null,
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
  const thirtyDaysAgo = formatDateInTimeZone(new Date(now.getTime() - 30 * DAY_MS), timezone);

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
  let latestRunTasks: Array<typeof routeOptimizationTasks.$inferSelect> = [];
  if (latestRun) {
    try {
      latestRunTasks = await getDb()
        .select()
        .from(routeOptimizationTasks)
        .where(eq(routeOptimizationTasks.runId, latestRun.id))
        .orderBy(
          asc(routeOptimizationTasks.serviceStartTime),
          asc(routeOptimizationTasks.createdAt),
        );
    } catch (error) {
      if (!isMissingTaskLinkColumnsError(error)) {
        throw error;
      }

      const legacyTasks = await getDb()
        .select({
          id: routeOptimizationTasks.id,
          runId: routeOptimizationTasks.runId,
          nurseId: routeOptimizationTasks.nurseId,
          visitId: routeOptimizationTasks.visitId,
          patientId: routeOptimizationTasks.patientId,
          patientName: routeOptimizationTasks.patientName,
          address: routeOptimizationTasks.address,
          windowStart: routeOptimizationTasks.windowStart,
          windowEnd: routeOptimizationTasks.windowEnd,
          windowType: routeOptimizationTasks.windowType,
          arrivalTime: routeOptimizationTasks.arrivalTime,
          serviceStartTime: routeOptimizationTasks.serviceStartTime,
          serviceEndTime: routeOptimizationTasks.serviceEndTime,
          waitSeconds: routeOptimizationTasks.waitSeconds,
          lateBySeconds: routeOptimizationTasks.lateBySeconds,
          onTime: routeOptimizationTasks.onTime,
          isUnscheduled: routeOptimizationTasks.isUnscheduled,
          unscheduledReason: routeOptimizationTasks.unscheduledReason,
          createdAt: routeOptimizationTasks.createdAt,
        })
        .from(routeOptimizationTasks)
        .where(eq(routeOptimizationTasks.runId, latestRun.id))
        .orderBy(
          asc(routeOptimizationTasks.serviceStartTime),
          asc(routeOptimizationTasks.createdAt),
        );

      latestRunTasks = legacyTasks.map((task) => ({
        ...task,
        visitInstanceId: null,
        templateId: null,
      }));
    }
  }

  const templateIds = [
    ...new Set(
      latestRunTasks
        .map((task) => task.templateId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const templateNameById = new Map<string, string>();
  if (templateIds.length > 0) {
    const templateRows = await getDb()
      .select({ id: recurringVisitTemplates.id, name: recurringVisitTemplates.name })
      .from(recurringVisitTemplates)
      .where(inArray(recurringVisitTemplates.id, templateIds));

    for (const row of Array.isArray(templateRows) ? templateRows : []) {
      if (row.name) {
        templateNameById.set(row.id, row.name);
      }
    }
  }

  const today = dateRange[dateRange.length - 1];
  const todayRuns = recentRuns.filter((run) => run.planningDate === today);

  const scheduledVisitsToday = todayRuns.reduce((total, run) => total + run.scheduledVisitCount, 0);
  const unscheduledVisitsToday = todayRuns.reduce(
    (total, run) => total + run.unscheduledVisitCount,
    0,
  );
  const totalDistanceTodayMeters = todayRuns.reduce(
    (total, run) => total + run.totalDistanceMeters,
    0,
  );

  const scheduledVisits7d = recentRuns.reduce((total, run) => total + run.scheduledVisitCount, 0);
  const totalDistanceMeters7d = recentRuns.reduce(
    (total, run) => total + run.totalDistanceMeters,
    0,
  );
  const totalDuration7dSeconds = recentRuns.reduce(
    (total, run) => total + run.totalDurationSeconds,
    0,
  );
  const onTimeVisits7d = recentRuns.reduce((total, run) => total + run.onTimeVisitCount, 0);
  const onTimeRatePercent7d =
    scheduledVisits7d > 0 ? Math.round((onTimeVisits7d / scheduledVisits7d) * 100) : null;

  const delayedRoutes = todayRuns.filter(
    (run) =>
      run.fixedWindowViolations > 0 || run.totalLateSeconds > 0 || run.unscheduledVisitCount > 0,
  ).length;

  const busiestDays = await buildBusiestDays(nurseId);
  const patientRisks = await buildPatientRisks(nurseId, thirtyDaysAgo);

  const [activePatientRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(patients)
    .where(and(eq(patients.nurseId, nurseId), eq(patients.isActive, true)));
  const activePatientCount = activePatientRow?.count ?? 0;

  let templatedActivePatientCount = 0;
  if (activePatientCount > 0) {
    const [templatedActivePatientRow] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(
        and(
          eq(patients.nurseId, nurseId),
          eq(patients.isActive, true),
          sql`exists (
            select 1
            from ${recurringVisitTemplates}
            where ${recurringVisitTemplates.nurseId} = ${nurseId}
              and ${recurringVisitTemplates.patientId} = ${patients.id}
              and ${recurringVisitTemplates.isActive} = true
          )`,
        ),
      );
    templatedActivePatientCount = templatedActivePatientRow?.count ?? 0;
  }

  const [deletedPatientsRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(patients)
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, false),
        gte(patients.updatedAt, new Date(now.getTime() - 30 * DAY_MS)),
      ),
    );
  const deletedClientsLast30Days = deletedPatientsRow?.count ?? 0;

  return {
    asOf: now.toISOString(),
    timezone,
    kpis: {
      routesToday: todayRuns.length,
      visitsScheduledToday: scheduledVisitsToday,
      visitsScheduledLast7Days: scheduledVisits7d,
      onTimeRatePercent7d,
      deletedClientsLast30Days,
      driveHoursLast7Days: roundToOneDecimal(totalDuration7dSeconds / 3600),
      totalDistanceKm7d: roundToOneDecimal(totalDistanceMeters7d / 1000),
      activePatientCount,
      templatedActivePatientCount,
    },
    alerts: buildAlerts({
      latestRun,
      latestRunWarnings,
      hasRecentRuns: recentRuns.length > 0,
    }),
    upcomingStops:
      latestRun && latestRunTasks.length > 0
        ? resolveUpcomingStops({
            latestRunId: latestRun.id,
            latestRunTimezone: latestRun.timezone,
            tasks: latestRunTasks,
            templateNameById,
            now,
          })
        : [],
    trend: buildTrend(dateRange, recentRuns),
    busiestDays,
    patientRisks,
    snapshot: {
      completedRoutes: todayRuns.length,
      delayedRoutes,
      unscheduledVisits: unscheduledVisitsToday,
      totalDistanceKm: roundToOneDecimal(totalDistanceTodayMeters / 1000),
    },
  };
};
