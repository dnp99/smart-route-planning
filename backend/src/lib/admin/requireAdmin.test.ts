import { afterEach, describe, expect, it, vi } from "vitest";

const { findValidAdminSessionWithAdminMock } = vi.hoisted(() => ({
  findValidAdminSessionWithAdminMock: vi.fn(),
}));

vi.mock("./adminSessionRepository", () => ({
  findValidAdminSessionWithAdmin: findValidAdminSessionWithAdminMock,
}));

import { requireAdmin } from "./requireAdmin";

describe("requireAdmin", () => {
  afterEach(() => {
    findValidAdminSessionWithAdminMock.mockReset();
  });

  it("extracts admin context from the admin session cookie", async () => {
    findValidAdminSessionWithAdminMock.mockResolvedValue({
      sessionId: "admin-session-1",
      adminId: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      isActive: true,
    });

    const request = new Request("http://localhost:3000/api/admin/nurses", {
      headers: { cookie: "routefy_admin_session=admin-session-1" },
    });

    await expect(requireAdmin(request)).resolves.toEqual({
      adminId: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      sessionId: "admin-session-1",
    });
  });

  it("throws when the admin session cookie is missing", async () => {
    const request = new Request("http://localhost:3000/api/admin/nurses");

    await expect(requireAdmin(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });

  it("does not accept a nurse session cookie", async () => {
    // A nurse cookie carries a different name, so no admin session id is read
    // and the repository is never even consulted.
    const request = new Request("http://localhost:3000/api/admin/nurses", {
      headers: { cookie: "careflow_session=nurse-session-1" },
    });

    await expect(requireAdmin(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
    expect(findValidAdminSessionWithAdminMock).not.toHaveBeenCalled();
  });

  it("throws when the admin session is invalid", async () => {
    findValidAdminSessionWithAdminMock.mockResolvedValue(null);
    const request = new Request("http://localhost:3000/api/admin/nurses", {
      headers: { cookie: "routefy_admin_session=missing" },
    });

    await expect(requireAdmin(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });

  it("throws when the admin is inactive", async () => {
    findValidAdminSessionWithAdminMock.mockResolvedValue({
      sessionId: "admin-session-1",
      adminId: "admin-1",
      email: "admin@example.com",
      displayName: "Root Admin",
      isActive: false,
    });

    const request = new Request("http://localhost:3000/api/admin/nurses", {
      headers: { cookie: "routefy_admin_session=admin-session-1" },
    });

    await expect(requireAdmin(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });
});
