import { describe, expect, it, vi } from "vitest";
import { buildNotificationItems } from "../../components/notifications/useNotifications";
import type { DashboardSummaryResponse, WeeklyWorkingHours } from "../../../../shared/contracts";

const makeSummary = (opts: {
  stale?: number;
  unscheduled?: number;
  delayed?: number;
}): DashboardSummaryResponse => ({
  asOf: "2026-07-02T00:00:00.000Z",
  timezone: "UTC",
  kpis: {
    routesToday: 0,
    visitsScheduledToday: 0,
    visitsScheduledLast7Days: 0,
    onTimeRatePercent7d: null,
    staleClientsCount: opts.stale ?? 0,
    driveHoursLast7Days: 0,
    totalDistanceKm7d: 0,
    activePatientCount: 0,
    templatedActivePatientCount: 0,
  },
  alerts: [],
  upcomingStops: [],
  trend: [],
  busiestDays: [],
  patientRisks: [],
  snapshot: {
    completedRoutes: 0,
    delayedRoutes: opts.delayed ?? 0,
    unscheduledVisits: opts.unscheduled ?? 0,
    totalDistanceKm: 0,
  },
});

const enabledHours = { monday: { enabled: true } } as unknown as WeeklyWorkingHours;
const noop = () => {};

describe("buildNotificationItems", () => {
  it("adds a setup item when working hours are not configured", () => {
    const items = buildNotificationItems(makeSummary({}), null, noop);
    const setup = items.find((i) => i.id === "setup-working-hours");
    expect(setup).toBeTruthy();
    expect(setup?.severity).toBe("action");
    expect(setup?.onSelect).toBeTypeOf("function");
  });

  it("fires onOpenAccountSettings from the setup item", () => {
    const onOpen = vi.fn();
    const items = buildNotificationItems(makeSummary({}), { workingHours: null }, onOpen);
    items.find((i) => i.id === "setup-working-hours")?.onSelect?.();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("omits the setup item once working hours are configured", () => {
    const items = buildNotificationItems(makeSummary({}), { workingHours: enabledHours }, noop);
    expect(items.find((i) => i.id === "setup-working-hours")).toBeUndefined();
  });

  it("adds a route-health item summarizing unscheduled and late", () => {
    const items = buildNotificationItems(
      makeSummary({ unscheduled: 2, delayed: 1 }),
      { workingHours: enabledHours },
      noop,
    );
    const health = items.find((i) => i.id === "route-health");
    expect(health?.to).toBe("/route-planner");
    expect(health?.count).toBe(3);
    expect(health?.detail).toBe("2 unscheduled visits · 1 route running late");
  });

  it("adds an idle item linking to the Idle tab", () => {
    const items = buildNotificationItems(
      makeSummary({ stale: 4 }),
      { workingHours: enabledHours },
      noop,
    );
    const idle = items.find((i) => i.id === "idle");
    expect(idle?.title).toBe("4 idle clients");
    expect(idle?.severity).toBe("info");
    expect(idle?.to).toBe("/clients?state=idle");
  });

  it("returns nothing when the day is clean and setup is complete", () => {
    const items = buildNotificationItems(makeSummary({}), { workingHours: enabledHours }, noop);
    expect(items).toHaveLength(0);
  });

  it("tolerates a missing summary (still surfaces setup)", () => {
    const items = buildNotificationItems(null, null, noop);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("setup-working-hours");
  });
});
