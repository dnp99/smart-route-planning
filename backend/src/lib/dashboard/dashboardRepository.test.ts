import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDb: getDbMock,
}));

import { getDashboardSummaryForNurse, recordOptimizationRun } from "./dashboardRepository";

// ── Mock chain helpers ────────────────────────────────────────────────────────

/** Builds a getDb() mock for queries ending in .orderBy(...) */
const makeSelectOrderByChain = (result: unknown[]) => {
  const orderByMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

/** Builds a getDb() mock for queries ending in .orderBy(...).limit(n) */
const makeSelectLimitChain = (result: unknown[]) => {
  const limitMock = vi.fn().mockResolvedValue(result);
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

/** Builds a getDb() mock for buildBusiestDays: .where().groupBy().orderBy() */
const makeSelectGroupByOrderByChain = (result: unknown[]) => {
  const orderByMock = vi.fn().mockResolvedValue(result);
  const groupByMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

/** Builds a getDb() mock for buildPatientRisks stats: .innerJoin().where().groupBy().having().orderBy().limit() */
const makeSelectJoinGroupByHavingLimitChain = (result: unknown[]) => {
  const limitMock = vi.fn().mockResolvedValue(result);
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const havingMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const groupByMock = vi.fn().mockReturnValue({ having: havingMock });
  const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
  const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
  const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

/** Builds a getDb() mock for patient name fetch: .from().where() resolves directly */
const makeSelectWhereChain = (result: unknown[]) => {
  const whereMock = vi.fn().mockResolvedValue(result);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

// select → from → where → limit (e.g. findNurseById)
const makeSelectWhereLimitChain = (result: unknown[]) => {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
};

// ── Data builders ─────────────────────────────────────────────────────────────

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  id: "run-1",
  nurseId: "nurse-1",
  planningDate: "2026-04-16",
  timezone: "America/Toronto",
  endpointVersion: "v2",
  optimizerVersion: "v2",
  algorithmVersion: "1.0.0",
  optimizationObjective: "time",
  preserveOrder: false,
  requestedVisitCount: 2,
  scheduledVisitCount: 2,
  onTimeVisitCount: 2,
  unscheduledVisitCount: 0,
  fixedWindowViolations: 0,
  totalLateSeconds: 0,
  totalWaitSeconds: 0,
  totalDistanceMeters: 10000,
  totalDurationSeconds: 3600,
  warnings: [] as unknown[],
  requestId: null,
  createdAt: new Date("2026-04-16T10:00:00.000Z"),
  ...overrides,
});

const makeRequest = () => ({
  planningDate: "2026-04-16",
  timezone: "America/Toronto",
  optimizationObjective: "time" as const,
  preserveOrder: false,
  start: { address: "1 Start St", googlePlaceId: null },
  end: { address: "1 Start St", googlePlaceId: null },
  visits: [
    {
      visitId: "visit-1",
      patientId: "patient-1",
      patientName: "Alice Smith",
      address: "123 Main St",
      windowStart: "09:00",
      windowEnd: "11:00",
      windowType: "fixed" as const,
      serviceDurationMinutes: 30,
    },
  ],
});

const makeResult = (overrides: Record<string, unknown> = {}) => ({
  algorithmVersion: "1.0.0",
  start: {
    address: "1 Start St",
    coords: { lat: 43.7, lon: -79.4 },
    departureTime: "2026-04-16T08:00:00.000Z",
  },
  end: { address: "1 Start St", coords: { lat: 43.7, lon: -79.4 } },
  orderedStops: [
    {
      stopId: "stop-1",
      address: "123 Main St",
      coords: { lat: 43.71, lon: -79.41 },
      arrivalTime: "2026-04-16T09:00:00.000Z",
      departureTime: "2026-04-16T09:30:00.000Z",
      distanceFromPreviousKm: 5,
      durationFromPreviousSeconds: 600,
      tasks: [
        {
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "Alice Smith",
          address: "123 Main St",
          windowStart: "09:00",
          windowEnd: "11:00",
          windowType: "fixed" as const,
          serviceDurationMinutes: 30,
          arrivalTime: "2026-04-16T09:00:00.000Z",
          serviceStartTime: "2026-04-16T09:00:00.000Z",
          serviceEndTime: "2026-04-16T09:30:00.000Z",
          waitSeconds: 0,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
    },
  ],
  routeLegs: [],
  unscheduledTasks: [],
  warnings: [],
  metrics: {
    fixedWindowViolations: 0,
    totalLateSeconds: 0,
    totalWaitSeconds: 0,
    totalDistanceMeters: 10000,
    totalDistanceKm: 10,
    totalDurationSeconds: 3600,
  },
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("dashboardRepository", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  describe("recordOptimizationRun", () => {
    it("persists run and tasks without a db.transaction", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-1" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const taskValuesMock = vi.fn().mockResolvedValue([]);
      const insertMock = vi
        .fn()
        .mockReturnValueOnce({ values: runValuesMock })
        .mockReturnValueOnce({ values: taskValuesMock });
      getDbMock.mockReturnValue({ insert: insertMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        requestId: "req-1",
        request: makeRequest(),
        result: makeResult(),
      });

      expect(insertMock).toHaveBeenCalledTimes(2);
      expect(runValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ nurseId: "nurse-1", planningDate: "2026-04-16" }),
      );
    });

    it("uses db.transaction when available", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-2" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const taskValuesMock = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi
        .fn()
        .mockReturnValueOnce({ values: runValuesMock })
        .mockReturnValueOnce({ values: taskValuesMock });
      const tx = { insert: txInsertMock };
      const transactionMock = vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      );
      getDbMock.mockReturnValue({ transaction: transactionMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v3",
        request: makeRequest(),
        result: makeResult(),
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(txInsertMock).toHaveBeenCalledTimes(2);
    });

    it("stops early when run insert returns no row", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: runValuesMock });
      getDbMock.mockReturnValue({ insert: insertMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        request: makeRequest(),
        result: makeResult(),
      });

      expect(insertMock).toHaveBeenCalledTimes(1); // only the run, no task insert
    });

    it("skips task insert when there are no tasks", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-1" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: runValuesMock });
      getDbMock.mockReturnValue({ insert: insertMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        request: { ...makeRequest(), visits: [] },
        result: makeResult({ orderedStops: [], unscheduledTasks: [] }),
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
    });

    it("maps unscheduled tasks and fills visit info from the request", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-1" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      let capturedTaskRows: unknown;
      const taskValuesMock = vi.fn().mockImplementation((rows: unknown) => {
        capturedTaskRows = rows;
        return Promise.resolve([]);
      });
      const insertMock = vi
        .fn()
        .mockReturnValueOnce({ values: runValuesMock })
        .mockReturnValueOnce({ values: taskValuesMock });
      getDbMock.mockReturnValue({ insert: insertMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        request: makeRequest(),
        result: makeResult({
          orderedStops: [],
          unscheduledTasks: [
            { visitId: "visit-1", patientId: "patient-1", reason: "fixed_window_unreachable" },
          ],
        }),
      });

      expect(capturedTaskRows).toEqual([
        expect.objectContaining({
          visitId: "visit-1",
          isUnscheduled: true,
          unscheduledReason: "fixed_window_unreachable",
          arrivalTime: null,
        }),
      ]);
    });

    it("converts ISO timestamp strings to Date objects for scheduled tasks", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-1" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      let capturedTaskRows: unknown;
      const taskValuesMock = vi.fn().mockImplementation((rows: unknown) => {
        capturedTaskRows = rows;
        return Promise.resolve([]);
      });
      const insertMock = vi
        .fn()
        .mockReturnValueOnce({ values: runValuesMock })
        .mockReturnValueOnce({ values: taskValuesMock });
      getDbMock.mockReturnValue({ insert: insertMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        request: makeRequest(),
        result: makeResult(),
      });

      expect(capturedTaskRows).toEqual([
        expect.objectContaining({
          arrivalTime: new Date("2026-04-16T09:00:00.000Z"),
          serviceStartTime: new Date("2026-04-16T09:00:00.000Z"),
          serviceEndTime: new Date("2026-04-16T09:30:00.000Z"),
        }),
      ]);
    });

    it("updates scheduled patients with lastScheduledAt and reactivates them", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "run-1" }]);
      const runValuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const taskValuesMock = vi.fn().mockResolvedValue([]);
      const insertMock = vi
        .fn()
        .mockReturnValueOnce({ values: runValuesMock })
        .mockReturnValueOnce({ values: taskValuesMock });
      const updateWhereMock = vi.fn().mockResolvedValue(undefined);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
      getDbMock.mockReturnValue({ insert: insertMock, update: updateMock });

      await recordOptimizationRun({
        nurseId: "nurse-1",
        endpointVersion: "v2",
        request: makeRequest(),
        result: makeResult(),
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          lastScheduledAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(updateWhereMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDashboardSummaryForNurse", () => {
    it("returns no-history alert when nurse has no runs at all", async () => {
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // recentRuns = []
      getDbMock.mockReturnValueOnce(makeSelectLimitChain([])); // fallback = []
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([])); // busiestDays
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([])); // patientRisks stats
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.kpis.routesToday).toBe(0);
      expect(result.kpis.onTimeRatePercent7d).toBeNull();
      expect(result.alerts[0].title).toBe("No route history yet");
      expect(result.alerts[0].level).toBe("heads_up");
      expect(result.upcomingStops).toHaveLength(0);
    });

    it("computes KPIs and trend from recent runs", async () => {
      const run = makeRun({
        planningDate: "2026-04-16",
        scheduledVisitCount: 4,
        onTimeVisitCount: 4,
        totalDurationSeconds: 14400,
        totalDistanceMeters: 25000,
      });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run])); // recentRuns = [run]
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // tasks = []
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([])); // busiestDays
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([])); // patientRisks stats
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 7 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 5 }])); // templatedActivePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.kpis.routesToday).toBe(1);
      expect(result.kpis.visitsScheduledToday).toBe(4);
      expect(result.kpis.onTimeRatePercent7d).toBe(100);
      expect(result.kpis.activePatientCount).toBe(7);
      expect(result.kpis.templatedActivePatientCount).toBe(5);
      expect(result.kpis.driveHoursLast7Days).toBe(4.0);
      expect(result.snapshot.totalDistanceKm).toBe(25.0);
      expect(result.trend).toHaveLength(7);
    });

    it("flags delayed routes when there are unscheduled visits and builds action_needed alert", async () => {
      const run = makeRun({ planningDate: "2026-04-16", unscheduledVisitCount: 2 });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.snapshot.delayedRoutes).toBe(1);
      expect(result.alerts[0].level).toBe("action_needed");
      expect(result.alerts[0].detail).toContain("2 visits");
    });

    it("maps warning types to correct alert levels", async () => {
      const run = makeRun({
        planningDate: "2026-04-16",
        warnings: [
          {
            type: "window_conflict",
            patientIds: ["p1", "p2"],
            patientNames: ["Alice", "Bob"],
            message: "Conflict between Alice and Bob",
          },
          { type: "lunch_skipped", message: "Lunch could not be scheduled" },
          {
            type: "outside_working_hours",
            overByMinutes: 15,
            message: "Route runs past working hours",
          },
        ],
      });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      const levels = result.alerts.map((a) => a.level);
      expect(levels).toContain("at_risk");
      expect(levels).toContain("heads_up");
    });

    it("uses fallback run when no recent runs exist in the 7-day window", async () => {
      const oldRun = makeRun({ planningDate: "2026-03-01" });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // recentRuns = []
      getDbMock.mockReturnValueOnce(makeSelectLimitChain([oldRun])); // fallback = [oldRun]
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // tasks = []
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([])); // busiestDays
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([])); // patientRisks stats
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.kpis.routesToday).toBe(0);
      expect(result.kpis.onTimeRatePercent7d).toBeNull();
      expect(result.alerts[0].title).toBe("No routes in the last 7 days");
      expect(result.alerts[0].detail).toContain("2026-03-01");
    });

    it("populates upcoming stops from latest run tasks", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      const now = new Date("2026-04-16T08:00:00.000Z");
      const tasks = [
        {
          id: "task-1",
          runId: "run-1",
          nurseId: "nurse-1",
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "Alice Smith",
          address: "123 Main St",
          serviceStartTime: new Date("2026-04-16T10:00:00.000Z"),
          serviceEndTime: new Date("2026-04-16T10:30:00.000Z"),
          onTime: true,
          isUnscheduled: false,
          createdAt: now,
        },
      ];
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain(tasks));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now,
      });

      expect(result.upcomingStops).toHaveLength(1);
      expect(result.upcomingStops[0].patientName).toBeNull();
      expect(result.upcomingStops[0].destination).toBe("Stop 1");
      expect(result.upcomingStops[0].status).toBe("on_track");
    });

    it("marks stop as at_risk when onTime is false", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      const now = new Date("2026-04-16T08:00:00.000Z");
      const tasks = [
        {
          id: "task-1",
          runId: "run-1",
          nurseId: "nurse-1",
          visitId: "visit-1",
          patientId: "patient-1",
          serviceStartTime: new Date("2026-04-16T10:00:00.000Z"),
          serviceEndTime: new Date("2026-04-16T10:30:00.000Z"),
          onTime: false,
          isUnscheduled: false,
          createdAt: now,
        },
      ];
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain(tasks));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now,
      });

      expect(result.upcomingStops[0].status).toBe("at_risk");
    });

    it("falls back to all scheduled stops when all are in the past", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      const now = new Date("2026-04-16T23:00:00.000Z");
      const tasks = [
        {
          id: "task-1",
          runId: "run-1",
          nurseId: "nurse-1",
          visitId: "visit-1",
          patientId: "patient-1",
          serviceStartTime: new Date("2026-04-16T09:00:00.000Z"),
          serviceEndTime: new Date("2026-04-16T09:30:00.000Z"), // already ended
          onTime: true,
          isUnscheduled: false,
          createdAt: new Date("2026-04-16T08:00:00.000Z"),
        },
      ];
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain(tasks));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now,
      });

      // All past → fall back to showing scheduled stops anyway
      expect(result.upcomingStops).toHaveLength(1);
    });

    it("returns empty upcoming stops when there are no scheduled tasks", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      const tasks = [
        {
          id: "task-1",
          runId: "run-1",
          nurseId: "nurse-1",
          visitId: "visit-1",
          patientId: "patient-1",
          serviceStartTime: null, // unscheduled — no Date
          serviceEndTime: null,
          onTime: null,
          isUnscheduled: true,
          createdAt: new Date("2026-04-16T08:00:00.000Z"),
        },
      ];
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain(tasks));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.upcomingStops).toHaveLength(0);
    });

    it("handles non-array warnings gracefully", async () => {
      const run = makeRun({ planningDate: "2026-04-16", warnings: "not-an-array" });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run]));
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.alerts).toBeDefined();
    });

    it("includes the timezone in the response", async () => {
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([]));
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([]));
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Vancouver",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.timezone).toBe("America/Vancouver");
    });

    it("returns busiest days mapped to day labels", async () => {
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // recentRuns
      getDbMock.mockReturnValueOnce(makeSelectLimitChain([])); // fallback
      getDbMock.mockReturnValueOnce(
        makeSelectGroupByOrderByChain([
          { dayOfWeek: 1, avgVisits: 4.5, totalRuns: 8 }, // Monday
          { dayOfWeek: 3, avgVisits: 3.0, totalRuns: 6 }, // Wednesday
        ]),
      ); // busiestDays
      getDbMock.mockReturnValueOnce(makeSelectJoinGroupByHavingLimitChain([])); // patientRisks stats
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.busiestDays).toHaveLength(2);
      expect(result.busiestDays[0].dayLabel).toBe("Mon");
      expect(result.busiestDays[0].avgVisits).toBe(4.5);
      expect(result.busiestDays[0].totalRuns).toBe(8);
      expect(result.busiestDays[1].dayLabel).toBe("Wed");
    });

    it("returns patient risks with names from the patients table", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run])); // recentRuns
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // tasks
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([])); // busiestDays
      getDbMock.mockReturnValueOnce(
        makeSelectJoinGroupByHavingLimitChain([
          { patientId: "patient-1", totalAppearances: 3, unscheduledCount: 2, lateCount: 1 },
        ]),
      ); // patientRisks stats
      getDbMock.mockReturnValueOnce(
        makeSelectWhereChain([{ id: "patient-1", firstName: "Alice", lastName: "Smith" }]),
      ); // patient names
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 3 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 2 }])); // templatedActivePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.patientRisks).toHaveLength(1);
      expect(result.patientRisks[0].firstName).toBe("Alice");
      expect(result.patientRisks[0].lastName).toBe("Smith");
      expect(result.patientRisks[0].unscheduledCount).toBe(2);
      expect(result.patientRisks[0].lateCount).toBe(1);
      expect(result.patientRisks[0].totalAppearances).toBe(3);
    });

    it("omits patient risk entry when patient record is not found", async () => {
      const run = makeRun({ planningDate: "2026-04-16" });
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([run])); // recentRuns
      getDbMock.mockReturnValueOnce(makeSelectOrderByChain([])); // tasks
      getDbMock.mockReturnValueOnce(makeSelectGroupByOrderByChain([])); // busiestDays
      getDbMock.mockReturnValueOnce(
        makeSelectJoinGroupByHavingLimitChain([
          { patientId: "ghost-patient", totalAppearances: 2, unscheduledCount: 1, lateCount: 0 },
        ]),
      ); // patientRisks stats
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([])); // patient not found
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // activePatientCount
      getDbMock.mockReturnValueOnce(
        makeSelectWhereLimitChain([{ id: "nurse-1", lastDeactivatedClientsAt: null }]),
      ); // findNurseById (stale-review snooze check)
      getDbMock.mockReturnValueOnce(makeSelectWhereChain([{ count: 0 }])); // staleClientsCount

      const result = await getDashboardSummaryForNurse({
        nurseId: "nurse-1",
        timezone: "America/Toronto",
        now: new Date("2026-04-16T14:00:00.000Z"),
      });

      expect(result.patientRisks).toHaveLength(0);
    });
  });
});
