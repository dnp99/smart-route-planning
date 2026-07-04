import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, resetNursePasswordMock, hashPasswordMock, logAdminAuditEventMock } =
  vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    resetNursePasswordMock: vi.fn(),
    hashPasswordMock: vi.fn(),
    logAdminAuditEventMock: vi.fn(),
  }));

vi.mock("../../../../../../lib/admin/requireAdmin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../../../../../../lib/admin/adminNurseRepository", () => ({
  resetNursePassword: resetNursePasswordMock,
}));
vi.mock("../../../../../../lib/auth/password", () => ({ hashPassword: hashPasswordMock }));
vi.mock("../../../../../../lib/admin/adminAuditLogger", () => ({
  logAdminAuditEvent: logAdminAuditEventMock,
}));

import { HttpError } from "../../../../../../lib/http";
import { POST } from "./route";

const buildRequest = () =>
  new Request("http://localhost:3000/api/admin/nurses/nurse-1/reset-password", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", cookie: "routefy_admin_session=s1" },
  });
const context = { params: { id: "nurse-1" } };

describe("/api/admin/nurses/[id]/reset-password route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAdminMock.mockReset();
    resetNursePasswordMock.mockReset();
    hashPasswordMock.mockReset();
    logAdminAuditEventMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  it("returns 404 when the nurse does not exist", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    hashPasswordMock.mockResolvedValue("hashed");
    resetNursePasswordMock.mockResolvedValue(null);
    const response = await POST(buildRequest(), context);
    expect(response.status).toBe(404);
    expect(logAdminAuditEventMock).not.toHaveBeenCalled();
  });

  it("returns a temporary password, hashes it, and audits the reset", async () => {
    requireAdminMock.mockResolvedValue({ adminId: "admin-1" });
    hashPasswordMock.mockResolvedValue("hashed");
    resetNursePasswordMock.mockResolvedValue({ id: "nurse-1" });

    const response = await POST(buildRequest(), context);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as { temporaryPassword: string };
    expect(typeof payload.temporaryPassword).toBe("string");
    expect(payload.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    // The plaintext returned to the admin is what was hashed and stored.
    expect(hashPasswordMock).toHaveBeenCalledWith(payload.temporaryPassword);
    expect(resetNursePasswordMock).toHaveBeenCalledWith("nurse-1", "hashed");
    expect(logAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.nurse.password_reset",
        resourceId: "nurse-1",
        outcome: "success",
      }),
    );
  });

  it("returns 401 when not signed in as admin", async () => {
    requireAdminMock.mockRejectedValue(new HttpError(401, "Unauthorized."));
    const response = await POST(buildRequest(), context);
    expect(response.status).toBe(401);
    expect(resetNursePasswordMock).not.toHaveBeenCalled();
  });
});
