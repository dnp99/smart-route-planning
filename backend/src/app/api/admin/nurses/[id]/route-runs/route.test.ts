import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, listNurseRouteRunsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listNurseRouteRunsMock: vi.fn(),
}));

vi.mock("../../../../../../lib/admin/requireAdmin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../../../../../../lib/admin/adminDashboardRepository", () => ({
  listNurseRouteRuns: listNurseRouteRunsMock,
}));

import { HttpError } from "../../../../../../lib/http";
import { GET } from "./route";

const buildRequest = (query = "") =>
  new Request(`http://localhost:3000/api/admin/nurses/nurse-1/route-runs${query}`, {
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });
const context = { params: { id: "nurse-1" } };

describe("/api/admin/nurses/[id]/route-runs route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    listNurseRouteRunsMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  it("returns 401 when not signed in as admin", async () => {
    requireAdminMock.mockRejectedValue(new HttpError(401, "Unauthorized."));
    const response = await GET(buildRequest(), context);
    expect(response.status).toBe(401);
    expect(listNurseRouteRunsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed before cursor", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    const response = await GET(buildRequest("?before=not-a-date"), context);
    expect(response.status).toBe(400);
    expect(listNurseRouteRunsMock).not.toHaveBeenCalled();
  });

  it("returns the first page (no cursor) with pagination flags", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    listNurseRouteRunsMock.mockResolvedValue({
      runs: [
        {
          id: "run-1",
          planningDate: "2026-07-03",
          createdAt: new Date("2026-07-03T14:00:00.000Z"),
          requestedVisitCount: 5,
          scheduledVisitCount: 4,
          unscheduledVisitCount: 1,
          onTimeVisitCount: 3,
          totalDurationSeconds: 6465,
          totalDistanceMeters: 139063,
          optimizationObjective: "time",
        },
      ],
      nextCursor: "2026-06-28T14:00:00.000Z",
      hasMore: true,
    });

    const response = await GET(buildRequest(), context);
    expect(response.status).toBe(200);
    expect(listNurseRouteRunsMock).toHaveBeenCalledWith("nurse-1", { before: null });

    const payload = await response.json();
    expect(payload.hasMore).toBe(true);
    expect(payload.nextCursor).toBe("2026-06-28T14:00:00.000Z");
    expect(payload.runs).toEqual([
      {
        id: "run-1",
        planningDate: "2026-07-03",
        createdAt: "2026-07-03T14:00:00.000Z",
        requestedVisitCount: 5,
        scheduledVisitCount: 4,
        unscheduledVisitCount: 1,
        onTimeVisitCount: 3,
        totalDurationSeconds: 6465,
        totalDistanceMeters: 139063,
        optimizationObjective: "time",
      },
    ]);
  });

  it("passes the before cursor through to the repository", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    listNurseRouteRunsMock.mockResolvedValue({ runs: [], nextCursor: null, hasMore: false });
    const response = await GET(buildRequest("?before=2026-06-28T14:00:00.000Z"), context);
    expect(response.status).toBe(200);
    expect(listNurseRouteRunsMock).toHaveBeenCalledWith("nurse-1", {
      before: new Date("2026-06-28T14:00:00.000Z"),
    });
  });
});
