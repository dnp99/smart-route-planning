import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, getAdminMetricsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getAdminMetricsMock: vi.fn(),
}));

vi.mock("../../../../lib/admin/requireAdmin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("../../../../lib/admin/adminDashboardRepository", () => ({
  getAdminMetrics: getAdminMetricsMock,
}));

import { HttpError } from "../../../../lib/http";
import { GET } from "./route";

const buildRequest = () =>
  new Request("http://localhost:3000/api/admin/metrics", {
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });

describe("/api/admin/metrics route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    getAdminMetricsMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("returns 401 when not signed in as admin", async () => {
    requireAdminMock.mockRejectedValue(new HttpError(401, "Unauthorized."));
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
    expect(getAdminMetricsMock).not.toHaveBeenCalled();
  });

  it("returns metrics for an admin", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    const metrics = {
      nurses: { total: 3, active: 2 },
      signups: { total: 3, last7Days: 1, last30Days: 3 },
      activeNurses: { dau: 1, wau: 2 },
      clientsAdded: { last7Days: 5, last30Days: 12 },
      signupTrend: [{ date: "2026-07-01", count: 2 }],
    };
    getAdminMetricsMock.mockResolvedValue(metrics);

    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ metrics });
  });
});
