import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, setNurseActiveMock, logAdminAuditEventMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  setNurseActiveMock: vi.fn(),
  logAdminAuditEventMock: vi.fn(),
}));

vi.mock("../../../../../../lib/admin/requireAdmin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../../../../../../lib/admin/adminNurseRepository", () => ({
  setNurseActive: setNurseActiveMock,
}));
vi.mock("../../../../../../lib/admin/adminAuditLogger", () => ({
  logAdminAuditEvent: logAdminAuditEventMock,
}));

import { POST } from "./route";

const buildRequest = () =>
  new Request("http://localhost:3000/api/admin/nurses/nurse-1/reactivate", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });
const context = { params: { id: "nurse-1" } };

describe("/api/admin/nurses/[id]/reactivate route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    setNurseActiveMock.mockReset();
    logAdminAuditEventMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  it("reactivates and audits the action", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    setNurseActiveMock.mockResolvedValue({ id: "nurse-1", isActive: true });
    const response = await POST(buildRequest(), context);
    expect(response.status).toBe(200);
    expect(setNurseActiveMock).toHaveBeenCalledWith("nurse-1", true);
    await expect(response.json()).resolves.toEqual({ nurse: { id: "nurse-1", isActive: true } });
    expect(logAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.nurse.reactivate", resourceId: "nurse-1" }),
    );
  });
});
