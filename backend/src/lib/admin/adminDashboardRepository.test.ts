import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("../../db", () => ({ getDb: getDbMock }));

import {
  getAdminMetrics,
  getNurseProfile,
  listNurseActivity,
  listNurseRouteRuns,
  listNursePatients,
  listNursesWithSummary,
} from "./adminDashboardRepository";

// A chainable Drizzle stub: every builder method returns the same proxy, and
// awaiting the proxy resolves the next queued result. Repository functions await
// their queries sequentially, so results are consumed in call order.
const makeDb = (results: unknown[]) => {
  const queue = [...results];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) =>
          resolve(queue.length > 0 ? queue.shift() : []);
      }
      return () => proxy;
    },
  });
  return proxy;
};

describe("adminDashboardRepository", () => {
  beforeEach(() => getDbMock.mockReset());

  it("merges nurse summary with active counts and coerces last-activity", async () => {
    getDbMock.mockReturnValue(
      makeDb([
        [
          {
            id: "n1",
            email: "a@x.com",
            displayName: "A",
            isActive: true,
            mustChangePassword: false,
            createdAt: new Date("2026-07-01"),
            lastLoginAt: null,
          },
          {
            id: "n2",
            email: "b@x.com",
            displayName: "B",
            isActive: true,
            mustChangePassword: false,
            createdAt: new Date("2026-06-01"),
            lastLoginAt: null,
          },
        ],
        [{ nurseId: "n1", count: 4 }],
        [{ nurseId: "n1", lastAt: "2026-07-03T10:00:00.000Z" }],
      ]),
    );

    const result = await listNursesWithSummary();
    expect(result[0]).toMatchObject({ id: "n1", activePatientCount: 4 });
    expect(result[0].lastActivityAt).toBeInstanceOf(Date);
    // n2 has no active-count row and no activity → defaults.
    expect(result[1]).toMatchObject({ id: "n2", activePatientCount: 0, lastActivityAt: null });
  });

  it("returns a nurse profile or null", async () => {
    getDbMock.mockReturnValue(makeDb([[{ id: "n1", email: "a@x.com" }]]));
    await expect(getNurseProfile("n1")).resolves.toMatchObject({ id: "n1" });

    getDbMock.mockReturnValue(makeDb([[]]));
    await expect(getNurseProfile("missing")).resolves.toBeNull();
  });

  it("lists patients and activity", async () => {
    getDbMock.mockReturnValue(makeDb([[{ id: "p1", firstName: "Jane" }]]));
    await expect(listNursePatients("n1")).resolves.toHaveLength(1);

    getDbMock.mockReturnValue(makeDb([[{ id: "e1", action: "login" }]]));
    await expect(listNurseActivity("n1", 5)).resolves.toHaveLength(1);
    // clamp path: absurd limit still returns
    getDbMock.mockReturnValue(makeDb([[]]));
    await expect(listNurseActivity("n1", 9999)).resolves.toEqual([]);
  });

  it("computes metrics with values and with empty fallbacks", async () => {
    const now = new Date("2026-07-04T12:00:00.000Z");
    getDbMock.mockReturnValue(
      makeDb([
        [{ total: 6, active: 5 }], // nurseTotals
        [{ total: 6 }], // signupTotal
        [{ total: 2 }], // signups7
        [{ total: 4 }], // signups30
        [{ n: 1 }], // dau
        [{ n: 3 }], // wau
        [{ n: 5 }], // clients7
        [{ n: 12 }], // clients30
        [{ day: "2026-07-03", count: 1 }], // trend
        [{ n: 16 }], // runs7
        [{ n: 20 }], // runs30
        [{ n: 16 }], // coverageTotal
        [{ n: 4 }], // coverageCovered
        [{ n: 0 }], // neverLoggedIn
        [{ n: 2 }], // noClients
      ]),
    );

    const metrics = await getAdminMetrics(now);
    expect(metrics.nurses).toEqual({ total: 6, active: 5 });
    expect(metrics.routeRuns).toEqual({ last7Days: 16, last30Days: 20 });
    expect(metrics.templateCoverage).toEqual({ covered: 4, total: 16 });
    expect(metrics.onboarding).toEqual({ neverLoggedIn: 0, noClients: 2 });
    expect(metrics.signupTrend).toHaveLength(14);
    expect(metrics.signupTrend[metrics.signupTrend.length - 2]).toEqual({
      date: "2026-07-03",
      count: 1,
    });

    // All-empty results exercise the ?? 0 fallbacks.
    getDbMock.mockReturnValue(makeDb(Array.from({ length: 15 }, () => [])));
    const empty = await getAdminMetrics(now);
    expect(empty.nurses).toEqual({ total: 0, active: 0 });
    expect(empty.routeRuns).toEqual({ last7Days: 0, last30Days: 0 });
    expect(empty.signupTrend).toHaveLength(14);
    expect(empty.signupTrend.every((point) => point.count === 0)).toBe(true);
  });

  it("paginates route runs: first window with more, and a cursor page", async () => {
    const now = new Date("2026-07-04T12:00:00.000Z");

    // First page (no cursor): a run in-window + a non-empty "older" probe → hasMore.
    getDbMock.mockReturnValue(
      makeDb([
        [{ id: "run-1", createdAt: new Date("2026-07-03T10:00:00.000Z") }],
        [{ id: "older" }],
      ]),
    );
    const first = await listNurseRouteRuns("n1", { now });
    expect(first.runs).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).not.toBeNull();

    // First page with no older runs → hasMore false, cursor null.
    getDbMock.mockReturnValue(makeDb([[{ id: "run-1", createdAt: new Date() }], []]));
    const firstNoMore = await listNurseRouteRuns("n1", { now });
    expect(firstNoMore.hasMore).toBe(false);
    expect(firstNoMore.nextCursor).toBeNull();

    // Cursor page: 31 rows (PAGE_SIZE + 1) → hasMore, sliced to 30 with a cursor.
    const rows = Array.from({ length: 31 }, (_, index) => ({
      id: `r${index}`,
      createdAt: new Date(now.getTime() - index * 1000),
    }));
    getDbMock.mockReturnValue(makeDb([rows]));
    const page = await listNurseRouteRuns("n1", { before: now });
    expect(page.runs).toHaveLength(30);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(rows[29].createdAt.toISOString());

    // Cursor page: fewer than a full page → no more.
    getDbMock.mockReturnValue(makeDb([[{ id: "r0", createdAt: now }]]));
    const lastPage = await listNurseRouteRuns("n1", { before: now });
    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.nextCursor).toBeNull();
  });
});
