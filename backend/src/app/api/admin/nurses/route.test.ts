import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, listNursesWithSummaryMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listNursesWithSummaryMock: vi.fn(),
}));

vi.mock("../../../../lib/admin/requireAdmin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("../../../../lib/admin/adminDashboardRepository", () => ({
  listNursesWithSummary: listNursesWithSummaryMock,
}));

import { HttpError } from "../../../../lib/http";
import { GET, OPTIONS } from "./route";

const buildRequest = () =>
  new Request("http://localhost:3000/api/admin/nurses", {
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });

describe("/api/admin/nurses route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    listNursesWithSummaryMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("responds 204 to preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/admin/nurses", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      }),
    );
    expect(response.status).toBe(204);
  });

  it("returns 401 when not signed in as admin", async () => {
    requireAdminMock.mockRejectedValue(new HttpError(401, "Unauthorized."));

    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
    expect(listNursesWithSummaryMock).not.toHaveBeenCalled();
  });

  it("returns the mapped nurse summary list for an admin", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1", email: "admin@example.com" });
    listNursesWithSummaryMock.mockResolvedValue([
      {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
        lastLoginAt: new Date("2026-07-03T09:00:00.000Z"),
        activePatientCount: 4,
        lastActivityAt: new Date("2026-07-03T09:30:00.000Z"),
      },
    ]);

    const response = await GET(buildRequest());
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.nurses).toEqual([
      {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        isActive: true,
        mustChangePassword: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        lastLoginAt: "2026-07-03T09:00:00.000Z",
        lastActivityAt: "2026-07-03T09:30:00.000Z",
        activePatientCount: 4,
      },
    ]);
  });
});
