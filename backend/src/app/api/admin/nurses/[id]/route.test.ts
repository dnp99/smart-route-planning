import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getNurseProfileMock,
  listNursePatientsMock,
  listNurseActivityMock,
  logAdminAuditEventMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getNurseProfileMock: vi.fn(),
  listNursePatientsMock: vi.fn(),
  listNurseActivityMock: vi.fn(),
  logAdminAuditEventMock: vi.fn(),
}));

vi.mock("../../../../../lib/admin/requireAdmin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("../../../../../lib/admin/adminDashboardRepository", () => ({
  getNurseProfile: getNurseProfileMock,
  listNursePatients: listNursePatientsMock,
  listNurseActivity: listNurseActivityMock,
}));

vi.mock("../../../../../lib/admin/adminAuditLogger", () => ({
  logAdminAuditEvent: logAdminAuditEventMock,
}));

import { HttpError } from "../../../../../lib/http";
import { GET } from "./route";

const buildRequest = () =>
  new Request("http://localhost:3000/api/admin/nurses/nurse-1", {
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });

const context = { params: { id: "nurse-1" } };

describe("/api/admin/nurses/[id] route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    getNurseProfileMock.mockReset();
    listNursePatientsMock.mockReset();
    listNurseActivityMock.mockReset();
    logAdminAuditEventMock.mockReset();
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
    const response = await GET(buildRequest(), context);
    expect(response.status).toBe(401);
    expect(getNurseProfileMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the nurse does not exist", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    getNurseProfileMock.mockResolvedValue(null);
    const response = await GET(buildRequest(), context);
    expect(response.status).toBe(404);
    expect(logAdminAuditEventMock).not.toHaveBeenCalled();
  });

  it("returns full detail and audits the PHI view", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    getNurseProfileMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      mustChangePassword: false,
      homeAddress: "1 Main St",
      createdAt: new Date("2026-07-01T10:00:00.000Z"),
      updatedAt: new Date("2026-07-01T10:00:00.000Z"),
      lastLoginAt: new Date("2026-07-03T09:00:00.000Z"),
    });
    listNursePatientsMock.mockResolvedValue([
      {
        id: "patient-1",
        firstName: "Jane",
        lastName: "Doe",
        address: "27 Bathurst St",
        isActive: true,
        archivedAt: null,
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);
    listNurseActivityMock.mockResolvedValue([
      {
        id: "evt-1",
        action: "patients.create",
        resourceType: "patient",
        resourceId: "patient-1",
        outcome: "success",
        metadata: {},
        ipAddress: null,
        userAgent: null,
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);

    const response = await GET(buildRequest(), context);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.nurse.email).toBe("nurse@example.com");
    expect(payload.patients).toHaveLength(1);
    expect(payload.patients[0].firstName).toBe("Jane");
    expect(payload.activity).toHaveLength(1);

    expect(logAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "admin.nurse.view",
        resourceType: "nurse",
        resourceId: "nurse-1",
        outcome: "success",
        metadata: { patientCount: 1, activityCount: 1 },
      }),
    );
  });
});
