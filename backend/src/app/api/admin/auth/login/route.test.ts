import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLoginRateLimitForTests } from "../../../auth/requestGuards";

const {
  findAdminByEmailMock,
  updateAdminLastLoginAtMock,
  verifyPasswordMock,
  createAdminSessionMock,
  logAdminAuditEventMock,
} = vi.hoisted(() => ({
  findAdminByEmailMock: vi.fn(),
  updateAdminLastLoginAtMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  createAdminSessionMock: vi.fn(),
  logAdminAuditEventMock: vi.fn(),
}));

vi.mock("../../../../../lib/admin/adminRepository", () => ({
  findAdminByEmail: findAdminByEmailMock,
  updateAdminLastLoginAt: updateAdminLastLoginAtMock,
}));

vi.mock("../../../../../lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

vi.mock("../../../../../lib/admin/adminSessionRepository", () => ({
  createAdminSession: createAdminSessionMock,
}));

vi.mock("../../../../../lib/admin/adminAuditLogger", () => ({
  logAdminAuditEvent: logAdminAuditEventMock,
}));

import { OPTIONS, POST } from "./route";

const buildRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/admin/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify(body),
  });

describe("/api/admin/auth/login route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "50";
    delete process.env.AUTH_ENFORCE_HTTPS;
    __resetLoginRateLimitForTests();
    findAdminByEmailMock.mockReset();
    updateAdminLastLoginAtMock.mockReset();
    verifyPasswordMock.mockReset();
    createAdminSessionMock.mockReset();
    logAdminAuditEventMock.mockReset();
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
      new Request("http://localhost:3000/api/admin/auth/login", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      }),
    );
    expect(response.status).toBe(204);
  });

  it("rejects an invalid payload with 400", async () => {
    const response = await POST(buildRequest({ email: "admin@example.com" }));
    expect(response.status).toBe(400);
    expect(findAdminByEmailMock).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown admin", async () => {
    findAdminByEmailMock.mockResolvedValue(null);
    const response = await POST(
      buildRequest({ email: "nobody@example.com", password: "secret12" }),
    );
    expect(response.status).toBe(401);
    expect(createAdminSessionMock).not.toHaveBeenCalled();
  });

  it("returns 401 and audits a denied attempt for a wrong password", async () => {
    findAdminByEmailMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      passwordHash: "hash",
      isActive: true,
    });
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ email: "admin@example.com", password: "wrongpass" }),
    );

    expect(response.status).toBe(401);
    expect(createAdminSessionMock).not.toHaveBeenCalled();
    expect(logAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "admin.login",
        outcome: "denied",
      }),
    );
  });

  it("returns 401 for an inactive admin", async () => {
    findAdminByEmailMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      passwordHash: "hash",
      isActive: false,
    });

    const response = await POST(buildRequest({ email: "admin@example.com", password: "secret12" }));

    expect(response.status).toBe(401);
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("issues a session cookie and audits success on valid credentials", async () => {
    findAdminByEmailMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      passwordHash: "hash",
      isActive: true,
    });
    verifyPasswordMock.mockResolvedValue(true);
    createAdminSessionMock.mockResolvedValue({ id: "admin-session-1" });

    const response = await POST(buildRequest({ email: "admin@example.com", password: "secret12" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("routefy_admin_session=admin-session-1");
    expect(updateAdminLastLoginAtMock).toHaveBeenCalledWith("admin-1");
    expect(logAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "admin.login",
        outcome: "success",
      }),
    );

    const payload = await response.json();
    expect(payload.admin).toEqual({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
    });
  });
});
