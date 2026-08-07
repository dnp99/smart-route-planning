import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import {
  createAdminSession,
  findValidAdminSessionWithAdmin,
  revokeAdminSession,
  touchAdminSession,
} from "./adminSessionRepository";

describe("adminSessionRepository", () => {
  beforeEach(() => getDbMock.mockReset());

  it("creates an admin session", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "s1", adminId: "a1" }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    getDbMock.mockReturnValue({ insert });

    await expect(
      createAdminSession({ adminId: "a1", ipAddress: "1.2.3.4", userAgent: "UA" }),
    ).resolves.toEqual({ id: "s1", adminId: "a1" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ adminId: "a1" }));
  });

  it("createAdminSession returns null when insert yields nothing", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
    getDbMock.mockReturnValue({ insert });
    await expect(createAdminSession({ adminId: "a1" })).resolves.toBeNull();
  });

  it("finds a valid admin session joined to the admin, or null", async () => {
    const limit = vi.fn().mockResolvedValue([{ sessionId: "s1", adminId: "a1", isActive: true }]);
    const where = vi.fn().mockReturnValue({ limit });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const select = vi.fn().mockReturnValue({ from });
    getDbMock.mockReturnValue({ select });
    await expect(findValidAdminSessionWithAdmin("s1")).resolves.toMatchObject({ adminId: "a1" });

    const emptyLimit = vi.fn().mockResolvedValue([]);
    getDbMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockReturnValue({ limit: emptyLimit }) }),
        }),
      }),
    });
    await expect(findValidAdminSessionWithAdmin("missing")).resolves.toBeNull();
  });

  it("touches and revokes sessions", async () => {
    const touchWhere = vi.fn().mockResolvedValue(undefined);
    const touchSet = vi.fn().mockReturnValue({ where: touchWhere });
    getDbMock.mockReturnValue({ update: vi.fn().mockReturnValue({ set: touchSet }) });
    await touchAdminSession("s1");
    expect(touchSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastSeenAt: expect.any(Date) }),
    );

    const revokeWhere = vi.fn().mockResolvedValue(undefined);
    const revokeSet = vi.fn().mockReturnValue({ where: revokeWhere });
    getDbMock.mockReturnValue({ update: vi.fn().mockReturnValue({ set: revokeSet }) });
    await revokeAdminSession("s1");
    expect(revokeSet).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });
});
