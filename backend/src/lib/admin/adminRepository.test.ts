import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import {
  findAdminByEmail,
  findAdminById,
  insertAdmin,
  updateAdminLastLoginAt,
} from "./adminRepository";

const selectDb = (rows: unknown[]) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
};

describe("adminRepository", () => {
  beforeEach(() => getDbMock.mockReset());

  it("finds an admin by email (normalized) or null", async () => {
    getDbMock.mockReturnValue(selectDb([{ id: "a1", email: "admin@x.com" }]));
    await expect(findAdminByEmail("  Admin@X.com ")).resolves.toMatchObject({ id: "a1" });

    getDbMock.mockReturnValue(selectDb([]));
    await expect(findAdminByEmail("none@x.com")).resolves.toBeNull();
  });

  it("finds an admin by id or null", async () => {
    getDbMock.mockReturnValue(selectDb([{ id: "a1" }]));
    await expect(findAdminById("a1")).resolves.toMatchObject({ id: "a1" });

    getDbMock.mockReturnValue(selectDb([]));
    await expect(findAdminById("missing")).resolves.toBeNull();
  });

  it("updates last login", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    getDbMock.mockReturnValue({ update });
    await updateAdminLastLoginAt("a1");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ lastLoginAt: expect.any(Date) }));
  });

  it("inserts an admin (email lowercased) and returns it, or null", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "a2", email: "new@x.com" }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    getDbMock.mockReturnValue({ insert });

    await expect(
      insertAdmin({ email: "New@X.com", displayName: "New", passwordHash: "h" }),
    ).resolves.toEqual({ id: "a2", email: "new@x.com" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ email: "new@x.com" }));

    const emptyReturning = vi.fn().mockResolvedValue([]);
    getDbMock.mockReturnValue({
      insert: vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockReturnValue({ returning: emptyReturning }) }),
    });
    await expect(
      insertAdmin({ email: "x@x.com", displayName: "X", passwordHash: "h" }),
    ).resolves.toBeNull();
  });
});
