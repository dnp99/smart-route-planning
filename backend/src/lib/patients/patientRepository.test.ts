import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, validateTimeWindowMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  validateTimeWindowMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDb: getDbMock,
}));

vi.mock("./patientValidation", () => ({
  validateTimeWindow: validateTimeWindowMock,
}));

import {
  createNurseAccount,
  createPatientForNurse,
  deletePatientForNurse,
  findNurseByEmail,
  findNurseById,
  findPatientByIdForNurse,
  listPatientsByNurse,
  NurseEmailConflictError,
  updateNurseLastLoginAt,
  updatePatientForNurse,
} from "./patientRepository";

describe("patientRepository", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    validateTimeWindowMock.mockReset();
  });

  it("finds nurse by id", async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: "nurse-1" }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(findNurseById("nurse-1")).resolves.toEqual({ id: "nurse-1" });
  });

  it("finds nurse by email", async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: "nurse-1", email: "nurse@example.com" }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(findNurseByEmail("nurse@example.com")).resolves.toEqual({
      id: "nurse-1",
      email: "nurse@example.com",
    });
  });

  it("creates nurse account", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "nurse-2", email: "nurse@example.com" }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    getDbMock.mockReturnValue({ insert: insertMock });

    await expect(
      createNurseAccount({
        displayName: "Nurse Two",
        email: "nurse@example.com",
        passwordHash: "hashed-password",
      }),
    ).resolves.toEqual({ id: "nurse-2", email: "nurse@example.com" });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalKey: expect.any(String),
        displayName: "Nurse Two",
        email: "nurse@example.com",
        passwordHash: "hashed-password",
        isActive: true,
      }),
    );
  });

  it("maps unique email constraint failures to NurseEmailConflictError", async () => {
    const returningMock = vi.fn().mockRejectedValue({ code: "23505" });
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    getDbMock.mockReturnValue({ insert: insertMock });

    await expect(
      createNurseAccount({
        displayName: "Nurse Two",
        email: "nurse@example.com",
        passwordHash: "hashed-password",
      }),
    ).rejects.toBeInstanceOf(NurseEmailConflictError);
  });

  it("updates nurse last login timestamp", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await updateNurseLastLoginAt("nurse-1");

    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastLoginAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(whereMock).toHaveBeenCalled();
  });

  it("lists patients for nurse with default ordering", async () => {
    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(listPatientsByNurse("nurse-1")).resolves.toEqual([{ id: "patient-1" }]);
  });

  it("lists patients for nurse with name query", async () => {
    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-2" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(listPatientsByNurse("nurse-1", " jane ")).resolves.toEqual([{ id: "patient-2" }]);
  });

  it("creates patient row for nurse", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    getDbMock.mockReturnValue({ insert: insertMock });

    await expect(
      createPatientForNurse("nurse-1", {
        firstName: "Jane",
        lastName: "Doe",
        address: "123 Main St",
        preferredVisitStartTime: "14:00",
        preferredVisitEndTime: "16:00",
        visitTimeType: "fixed",
      }),
    ).resolves.toEqual({ id: "patient-1" });
  });

  it("finds patient by id for nurse", async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(findPatientByIdForNurse("nurse-1", "patient-1")).resolves.toEqual({ id: "patient-1" });
  });

  it("returns null when patient lookup is empty", async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(findPatientByIdForNurse("nurse-1", "missing")).resolves.toBeNull();
  });

  it("returns null when update target does not exist", async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock, update: vi.fn() });

    await expect(updatePatientForNurse("nurse-1", "missing", { firstName: "A" })).resolves.toBeNull();
  });

  it("updates existing patient row", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: findWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1", firstName: "Janet" }]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    getDbMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await expect(
      updatePatientForNurse("nurse-1", "patient-1", {
        firstName: "Janet",
      }),
    ).resolves.toEqual({ id: "patient-1", firstName: "Janet" });

    expect(validateTimeWindowMock).toHaveBeenCalledWith("09:00", "11:00");
  });

  it("returns null when update query returns no row", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: findWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const returningMock = vi.fn().mockResolvedValue([]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    getDbMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await expect(updatePatientForNurse("nurse-1", "patient-1", {})).resolves.toBeNull();
  });

  it("allows clearing googlePlaceId during update", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-123",
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: findWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1", googlePlaceId: null }]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    getDbMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await updatePatientForNurse("nurse-1", "patient-1", { googlePlaceId: null });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googlePlaceId: null,
      }),
    );
  });

  it("clears googlePlaceId when address changes and googlePlaceId is omitted", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-123",
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: findWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1", googlePlaceId: null }]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    getDbMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await updatePatientForNurse("nurse-1", "patient-1", { address: "456 Queen St" });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "456 Queen St",
        googlePlaceId: null,
      }),
    );
  });

  it("deletes patient row", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
    getDbMock.mockReturnValue({ delete: deleteMock });

    await expect(deletePatientForNurse("nurse-1", "patient-1")).resolves.toEqual({ id: "patient-1" });
  });

  it("returns null when delete query removes nothing", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
    getDbMock.mockReturnValue({ delete: deleteMock });

    await expect(deletePatientForNurse("nurse-1", "missing")).resolves.toBeNull();
  });
});
