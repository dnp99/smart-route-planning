import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, findNurseByIdMock, getDashboardSummaryForNurseMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findNurseByIdMock: vi.fn(),
  getDashboardSummaryForNurseMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
}));

vi.mock("../../../../lib/dashboard/dashboardRepository", () => ({
  getDashboardSummaryForNurse: getDashboardSummaryForNurseMock,
}));

import { GET, OPTIONS } from "./route";

describe("/api/dashboard/summary route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    findNurseByIdMock.mockReset();
    getDashboardSummaryForNurseMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    findNurseByIdMock.mockResolvedValue({ id: "nurse-1", isActive: true });
    getDashboardSummaryForNurseMock.mockResolvedValue({
      asOf: "2026-04-16T12:00:00.000Z",
      timezone: "America/Toronto",
      kpis: {
        routesToday: 3,
        visitsScheduledToday: 12,
        onTimeRatePercent7d: 92,
        deletedClientsLast30Days: 1,
        driveHoursLast7Days: 7.5,
        activePatientCount: 24,
        templatedActivePatientCount: 8,
      },
      alerts: [
        {
          title: "Unscheduled visits",
          detail: "1 visit could not be scheduled in the latest plan.",
          level: "action_needed",
        },
      ],
      upcomingStops: [
        {
          time: "10:15 AM",
          route: "R-ABCD",
          destination: "189 Queen St",
          status: "on_track",
        },
      ],
      trend: [
        {
          date: "2026-04-16",
          label: "Thu",
          onTimeRatePercent: 92,
        },
      ],
      busiestDays: [],
      patientRisks: [],
      snapshot: {
        completedRoutes: 3,
        delayedRoutes: 1,
        unscheduledVisits: 1,
        totalDistanceKm: 48.2,
      },
    });
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("handles OPTIONS preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/dashboard/summary", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
  });

  it("returns 401 when authorization is missing or invalid", async () => {
    requireAuthMock.mockRejectedValue(
      new HttpError(401, "Missing or invalid authorization token."),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid authorization token.",
    });
  });

  it("returns 401 when nurse is not active", async () => {
    findNurseByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 when timezone query is invalid", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary?timezone=Invalid/Nowhere", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "timezone must be a valid IANA timezone.",
    });
  });

  it("returns dashboard summary payload", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary?timezone=America/Toronto", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    expect(getDashboardSummaryForNurseMock).toHaveBeenCalledWith({
      nurseId: "nurse-1",
      timezone: "America/Toronto",
    });

    const payload = await response.json();
    expect(payload.kpis.routesToday).toBe(3);
    expect(payload.upcomingStops).toHaveLength(1);
  });

  it("maps unexpected summary payload shape to 500", async () => {
    getDashboardSummaryForNurseMock.mockResolvedValue({ nope: true });

    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to shape dashboard summary response.",
    });
  });
});
