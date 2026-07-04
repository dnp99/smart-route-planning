import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import { resetNursePassword, setNurseActive } from "./adminNurseRepository";

const returningDb = (rows: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { update }, set };
};

describe("adminNurseRepository", () => {
  beforeEach(() => getDbMock.mockReset());

  it("setNurseActive returns the updated row", async () => {
    const { db, set } = returningDb([{ id: "n1", isActive: false }]);
    getDbMock.mockReturnValue(db);
    await expect(setNurseActive("n1", false)).resolves.toEqual({ id: "n1", isActive: false });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  it("setNurseActive returns null when no nurse matched", async () => {
    const { db } = returningDb([]);
    getDbMock.mockReturnValue(db);
    await expect(setNurseActive("missing", true)).resolves.toBeNull();
  });

  it("resetNursePassword sets the hash and mustChangePassword", async () => {
    const { db, set } = returningDb([{ id: "n1" }]);
    getDbMock.mockReturnValue(db);
    await expect(resetNursePassword("n1", "hash")).resolves.toEqual({ id: "n1" });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hash", mustChangePassword: true }),
    );
  });

  it("resetNursePassword returns null when no nurse matched", async () => {
    const { db } = returningDb([]);
    getDbMock.mockReturnValue(db);
    await expect(resetNursePassword("missing", "hash")).resolves.toBeNull();
  });
});
