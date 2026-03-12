import { afterEach, describe, expect, it, vi } from "vitest";

const { getDatabaseUrlMock, findNurseByExternalKeyMock } = vi.hoisted(() => ({
  getDatabaseUrlMock: vi.fn(),
  findNurseByExternalKeyMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDatabaseUrl: getDatabaseUrlMock,
}));

vi.mock("./patientRepository", () => ({
  findNurseByExternalKey: findNurseByExternalKeyMock,
}));

import { resolveNurseContext } from "./nurseContext";

describe("resolveNurseContext", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalPoc = process.env.DEFAULT_NURSE_POC;
  const originalNurseId = process.env.DEFAULT_NURSE_ID;

  afterEach(() => {
    getDatabaseUrlMock.mockReset();
    findNurseByExternalKeyMock.mockReset();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalPoc === undefined) {
      delete process.env.DEFAULT_NURSE_POC;
    } else {
      process.env.DEFAULT_NURSE_POC = originalPoc;
    }

    if (originalNurseId === undefined) {
      delete process.env.DEFAULT_NURSE_ID;
    } else {
      process.env.DEFAULT_NURSE_ID = originalNurseId;
    }
  });

  it("throws when DATABASE_URL is missing", async () => {
    getDatabaseUrlMock.mockImplementation(() => {
      throw new Error("missing");
    });

    await expect(resolveNurseContext()).rejects.toMatchObject({
      status: 500,
      message: "Server is missing DATABASE_URL configuration.",
    });
  });

  it("throws when DEFAULT_NURSE_POC is not true", async () => {
    getDatabaseUrlMock.mockReturnValue("postgres://example");
    process.env.DEFAULT_NURSE_POC = "false";

    await expect(resolveNurseContext()).rejects.toMatchObject({
      status: 500,
      message: "Patient endpoints are unsupported unless DEFAULT_NURSE_POC=true.",
    });
  });

  it("throws when DEFAULT_NURSE_ID is missing", async () => {
    getDatabaseUrlMock.mockReturnValue("postgres://example");
    process.env.DEFAULT_NURSE_POC = "true";
    delete process.env.DEFAULT_NURSE_ID;

    await expect(resolveNurseContext()).rejects.toMatchObject({
      status: 500,
      message: "Server is missing DEFAULT_NURSE_ID configuration.",
    });
  });

  it("throws when configured nurse does not exist", async () => {
    getDatabaseUrlMock.mockReturnValue("postgres://example");
    process.env.DEFAULT_NURSE_POC = "true";
    process.env.DEFAULT_NURSE_ID = "default-nurse";
    findNurseByExternalKeyMock.mockResolvedValue(null);

    await expect(resolveNurseContext()).rejects.toMatchObject({
      status: 500,
      message: "Configured DEFAULT_NURSE_ID 'default-nurse' was not found in nurses table.",
    });
  });

  it("resolves nurse context from env and repository", async () => {
    getDatabaseUrlMock.mockReturnValue("postgres://example");
    process.env.DEFAULT_NURSE_POC = "true";
    process.env.DEFAULT_NURSE_ID = "default-nurse";
    findNurseByExternalKeyMock.mockResolvedValue({
      id: "nurse-1",
      externalKey: "default-nurse",
    });

    await expect(resolveNurseContext()).resolves.toEqual({
      nurseId: "nurse-1",
      nurseExternalKey: "default-nurse",
    });
    expect(findNurseByExternalKeyMock).toHaveBeenCalledWith("default-nurse");
  });
});
