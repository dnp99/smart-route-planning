import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDb: getDbMock,
}));

import {
  archivePatientsForNurse,
  countPatientsByStateForNurse,
  countStaleClientsForNurse,
  createNurseAccount,
  createPatientForNurse,
  deletePatientForNurse,
  findNurseByEmail,
  findNurseById,
  findPatientByIdForNurse,
  listPatientsByNurse,
  NurseEmailConflictError,
  restorePatientForNurse,
  updateNurseDisplayName,
  updateNurseHomeAddress,
  updateNurseLastLoginAt,
  updatePatientForNurse,
} from "./patientRepository";

describe("patientRepository", () => {
  beforeEach(() => {
    getDbMock.mockReset();
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
    const returningMock = vi
      .fn()
      .mockResolvedValue([{ id: "nurse-2", email: "nurse@example.com" }]);
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

  it("rethrows non-unique create nurse errors", async () => {
    const databaseError = new Error("db down");
    const returningMock = vi.fn().mockRejectedValue(databaseError);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    getDbMock.mockReturnValue({ insert: insertMock });

    await expect(
      createNurseAccount({
        displayName: "Nurse Two",
        email: "nurse@example.com",
        passwordHash: "hashed-password",
      }),
    ).rejects.toBe(databaseError);
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

  it("updates nurse home address", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "nurse-1", homeAddress: "1 Main St" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(updateNurseHomeAddress("nurse-1", "1 Main St")).resolves.toEqual({
      id: "nurse-1",
      homeAddress: "1 Main St",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        homeAddress: "1 Main St",
        updatedAt: expect.any(Date),
      }),
    );
    expect(whereMock).toHaveBeenCalled();
  });

  it("updates nurse display name", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "nurse-1", displayName: "Alex Brown" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(updateNurseDisplayName("nurse-1", "Alex Brown")).resolves.toEqual({
      id: "nurse-1",
      displayName: "Alex Brown",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Alex Brown",
        updatedAt: expect.any(Date),
      }),
    );
    expect(whereMock).toHaveBeenCalled();
  });

  it("lists patients for nurse with default ordering", async () => {
    // Claim returns [] — deactivation already ran within 24h, skipped.
    const nurseClaimReturningMock = vi.fn().mockResolvedValue([]);
    const nurseClaimWhereMock = vi.fn().mockReturnValue({ returning: nurseClaimReturningMock });
    const nurseClaimSetMock = vi.fn().mockReturnValue({ where: nurseClaimWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: nurseClaimSetMock });

    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await expect(listPatientsByNurse("nurse-1")).resolves.toEqual([
      { id: "patient-1", visitWindows: [] },
    ]);
  });

  it("lists patients for nurse with name query", async () => {
    // Claim returns [] — deactivation already ran within 24h, skipped.
    const nurseClaimReturningMock = vi.fn().mockResolvedValue([]);
    const nurseClaimWhereMock = vi.fn().mockReturnValue({ returning: nurseClaimReturningMock });
    const nurseClaimSetMock = vi.fn().mockReturnValue({ where: nurseClaimWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: nurseClaimSetMock });

    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-2" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await expect(listPatientsByNurse("nurse-1", { query: " jane " })).resolves.toEqual([
      { id: "patient-2", visitWindows: [] },
    ]);
  });

  it("does not deactivate any patients while listing (auto-archive removed)", async () => {
    const updateMock = vi.fn();
    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await listPatientsByNurse("nurse-1");

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("lists archived clients for state=archived", async () => {
    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-9" }]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const windowsWhereMock = vi.fn().mockResolvedValue([]);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });
    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: fromMock })
      .mockReturnValueOnce({ from: windowsFromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(listPatientsByNurse("nurse-1", { state: "archived" })).resolves.toEqual([
      { id: "patient-9", visitWindows: [] },
    ]);
  });

  it("restorePatientForNurse reactivates a client and clears archived_at", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1", isActive: true }]);
    const restoreWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const restoreSetMock = vi.fn().mockReturnValue({ where: restoreWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: restoreSetMock });

    const windowsWhereMock = vi.fn().mockResolvedValue([]);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: windowsFromMock });

    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await expect(restorePatientForNurse("nurse-1", "patient-1")).resolves.toEqual({
      id: "patient-1",
      isActive: true,
      visitWindows: [],
    });
    expect(restoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, archivedAt: null, updatedAt: expect.any(Date) }),
    );
  });

  it("restorePatientForNurse returns null when nothing is restorable", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const restoreWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const restoreSetMock = vi.fn().mockReturnValue({ where: restoreWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: restoreSetMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(restorePatientForNurse("nurse-1", "patient-x")).resolves.toBeNull();
  });

  it("archivePatientsForNurse soft-deletes the requested ids and returns them", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1" }, { id: "patient-2" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(archivePatientsForNurse("nurse-1", ["patient-1", "patient-2"])).resolves.toEqual([
      "patient-1",
      "patient-2",
    ]);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
        archivedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("archivePatientsForNurse is a no-op for an empty id list", async () => {
    const updateMock = vi.fn();
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(archivePatientsForNurse("nurse-1", [])).resolves.toEqual([]);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("countStaleClientsForNurse counts idle active clients in a single query", async () => {
    const countWhereMock = vi.fn().mockResolvedValue([{ count: 3 }]);
    const countFromMock = vi.fn().mockReturnValue({ where: countWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: countFromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(countStaleClientsForNurse("nurse-1")).resolves.toBe(3);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("countPatientsByStateForNurse returns active/idle/archived counts", async () => {
    const countChain = (n: number) => {
      const whereMock = vi.fn().mockResolvedValue([{ count: n }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    };
    const selectMock = vi
      .fn()
      .mockReturnValueOnce(countChain(5))
      .mockReturnValueOnce(countChain(3))
      .mockReturnValueOnce(countChain(2));
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(countPatientsByStateForNurse("nurse-1")).resolves.toEqual({
      active: 5,
      idle: 3,
      archived: 2,
    });
    expect(selectMock).toHaveBeenCalledTimes(3);
  });

  it("attaches and sorts visit windows by start, end, and createdAt", async () => {
    const nurseClaimReturningMock = vi.fn().mockResolvedValue([]);
    const nurseClaimWhereMock = vi.fn().mockReturnValue({ returning: nurseClaimReturningMock });
    const nurseClaimSetMock = vi.fn().mockReturnValue({ where: nurseClaimWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: nurseClaimSetMock });

    const patientRows = [{ id: "patient-1" }, { id: "patient-2" }];
    const windows = [
      {
        id: "window-2",
        patientId: "patient-1",
        startTime: "10:00",
        endTime: "11:00",
        visitTimeType: "fixed",
        createdAt: new Date("2026-03-12T10:00:00.000Z"),
      },
      {
        id: "window-1",
        patientId: "patient-1",
        startTime: "09:00",
        endTime: "11:00",
        visitTimeType: "fixed",
        createdAt: new Date("2026-03-12T09:00:00.000Z"),
      },
      {
        id: "window-4",
        patientId: "patient-2",
        startTime: "09:00",
        endTime: "09:30",
        visitTimeType: "flexible",
        createdAt: new Date("2026-03-12T11:00:00.000Z"),
      },
      {
        id: "window-3",
        patientId: "patient-1",
        startTime: "09:00",
        endTime: "10:00",
        visitTimeType: "fixed",
        createdAt: new Date("2026-03-12T12:00:00.000Z"),
      },
      {
        id: "window-5",
        patientId: "patient-1",
        startTime: "09:00",
        endTime: "10:00",
        visitTimeType: "fixed",
        createdAt: new Date("2026-03-12T08:00:00.000Z"),
      },
    ];

    const orderByMock = vi.fn().mockResolvedValue(patientRows);
    const patientWhereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const patientFromMock = vi.fn().mockReturnValue({ where: patientWhereMock });

    const windowsWhereMock = vi.fn().mockResolvedValue(windows);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });

    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: patientFromMock })
      .mockReturnValueOnce({ from: windowsFromMock });

    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await expect(listPatientsByNurse("nurse-1")).resolves.toEqual([
      {
        id: "patient-1",
        visitWindows: [
          expect.objectContaining({ id: "window-5" }),
          expect.objectContaining({ id: "window-3" }),
          expect.objectContaining({ id: "window-1" }),
          expect.objectContaining({ id: "window-2" }),
        ],
      },
      {
        id: "patient-2",
        visitWindows: [expect.objectContaining({ id: "window-4" })],
      },
    ]);
  });

  it("handles non-array visit windows query results", async () => {
    const nurseClaimReturningMock = vi.fn().mockResolvedValue([]);
    const nurseClaimWhereMock = vi.fn().mockReturnValue({ returning: nurseClaimReturningMock });
    const nurseClaimSetMock = vi.fn().mockReturnValue({ where: nurseClaimWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: nurseClaimSetMock });

    const orderByMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const patientWhereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const patientFromMock = vi.fn().mockReturnValue({ where: patientWhereMock });

    const windowsWhereMock = vi.fn().mockResolvedValue(undefined);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });

    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: patientFromMock })
      .mockReturnValueOnce({ from: windowsFromMock });

    getDbMock.mockReturnValue({ update: updateMock, select: selectMock });

    await expect(listPatientsByNurse("nurse-1")).resolves.toEqual([
      { id: "patient-1", visitWindows: [] },
    ]);
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
        visitDurationMinutes: 30,
        visitWindows: [
          {
            startTime: "14:00",
            endTime: "16:00",
            visitTimeType: "fixed",
          },
        ],
      }),
    ).resolves.toEqual({ id: "patient-1", visitWindows: [{ id: "patient-1" }] });
  });

  it("creates flexible patient without persisted windows", async () => {
    const patientReturningMock = vi
      .fn()
      .mockResolvedValue([{ id: "patient-2", visitTimeType: "flexible" }]);
    const patientValuesMock = vi.fn().mockReturnValue({ returning: patientReturningMock });
    const insertMock = vi.fn().mockReturnValueOnce({ values: patientValuesMock });

    getDbMock.mockReturnValue({ insert: insertMock });

    await expect(
      createPatientForNurse("nurse-1", {
        firstName: "No",
        lastName: "Window",
        address: "123 Main St",
        visitDurationMinutes: 30,
        visitWindows: [],
      }),
    ).resolves.toEqual({ id: "patient-2", visitTimeType: "flexible", visitWindows: [] });

    expect(patientValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visitDurationMinutes: 30,
        preferredVisitStartTime: "00:00",
        preferredVisitEndTime: "23:59",
        visitTimeType: "flexible",
      }),
    );
  });

  it("uses db.transaction when available for createPatientForNurse", async () => {
    const patientReturningMock = vi.fn().mockResolvedValue([{ id: "patient-3" }]);
    const patientValuesMock = vi.fn().mockReturnValue({ returning: patientReturningMock });

    const windowRows = [{ id: "window-1", patientId: "patient-3" }];
    const windowsReturningMock = vi.fn().mockResolvedValue(windowRows);
    const windowsValuesMock = vi.fn().mockReturnValue({ returning: windowsReturningMock });

    const txInsertMock = vi
      .fn()
      .mockReturnValueOnce({ values: patientValuesMock })
      .mockReturnValueOnce({ values: windowsValuesMock });

    const tx = {
      insert: txInsertMock,
    };
    const transactionMock = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));

    getDbMock.mockReturnValue({
      transaction: transactionMock,
    });

    await expect(
      createPatientForNurse("nurse-1", {
        firstName: "Tx",
        lastName: "Patient",
        address: "123 Main St",
        visitDurationMinutes: 30,
        visitWindows: [
          {
            startTime: "09:00",
            endTime: "10:00",
            visitTimeType: "fixed",
          },
        ],
      }),
    ).resolves.toEqual({ id: "patient-3", visitWindows: windowRows });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txInsertMock).toHaveBeenCalledTimes(2);
  });

  it("finds patient by id for nurse", async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockReturnValue({ select: selectMock });

    await expect(findPatientByIdForNurse("nurse-1", "patient-1")).resolves.toEqual({
      id: "patient-1",
      visitWindows: [],
    });
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

    await expect(
      updatePatientForNurse("nurse-1", "missing", { firstName: "A" }),
    ).resolves.toBeNull();
  });

  it("updates existing patient row", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      visitDurationMinutes: 30,
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
    ).resolves.toEqual({ id: "patient-1", firstName: "Janet", visitWindows: [] });
  });

  it("returns null when update query returns no row", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      visitDurationMinutes: 30,
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
      visitDurationMinutes: 30,
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
      visitDurationMinutes: 30,
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

  it("replaces visit windows during update when visitWindows payload is provided", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      visitDurationMinutes: 30,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const existingWindows = [
      {
        id: "window-existing",
        patientId: "patient-1",
        startTime: "09:00",
        endTime: "10:00",
        visitTimeType: "fixed",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
      },
    ];

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const patientFromMock = vi.fn().mockReturnValue({ where: findWhereMock });

    const windowsWhereMock = vi.fn().mockResolvedValue(existingWindows);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });

    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: patientFromMock })
      .mockReturnValueOnce({ from: windowsFromMock });

    const updatedRow = {
      id: "patient-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      visitDurationMinutes: 30,
      preferredVisitStartTime: "13:00",
      preferredVisitEndTime: "14:00",
      visitTimeType: "flexible",
    };
    const updateReturningMock = vi.fn().mockResolvedValue([updatedRow]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

    const insertedWindows = [
      {
        id: "window-new",
        patientId: "patient-1",
        startTime: "13:00",
        endTime: "14:00",
        visitTimeType: "flexible",
      },
    ];
    const insertReturningMock = vi.fn().mockResolvedValue(insertedWindows);
    const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
    const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

    const tx = {
      update: updateMock,
      delete: deleteMock,
      insert: insertMock,
    };
    const transactionMock = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));

    getDbMock.mockReturnValue({
      select: selectMock,
      transaction: transactionMock,
    });

    await expect(
      updatePatientForNurse("nurse-1", "patient-1", {
        visitWindows: [
          {
            startTime: "13:00",
            endTime: "14:00",
            visitTimeType: "flexible",
          },
        ],
      }),
    ).resolves.toEqual({
      ...updatedRow,
      visitWindows: insertedWindows,
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredVisitStartTime: "13:00",
        preferredVisitEndTime: "14:00",
        visitTimeType: "flexible",
      }),
    );
  });

  it("applies fallback primary window when visitWindows is updated to empty", async () => {
    const existingPatient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: null,
      visitDurationMinutes: 30,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "fixed",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    };

    const limitMock = vi.fn().mockResolvedValue([existingPatient]);
    const findWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const patientFromMock = vi.fn().mockReturnValue({ where: findWhereMock });
    const windowsWhereMock = vi.fn().mockResolvedValue([]);
    const windowsFromMock = vi.fn().mockReturnValue({ where: windowsWhereMock });
    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: patientFromMock })
      .mockReturnValueOnce({ from: windowsFromMock });

    const updateReturningMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

    const tx = {
      update: updateMock,
      delete: deleteMock,
      insert: vi.fn(),
    };
    const transactionMock = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));

    getDbMock.mockReturnValue({
      select: selectMock,
      transaction: transactionMock,
    });

    await updatePatientForNurse("nurse-1", "patient-1", { visitWindows: [] });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredVisitStartTime: "00:00",
        preferredVisitEndTime: "23:59",
        visitTimeType: "flexible",
      }),
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("soft-deletes patient row by marking it inactive", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "patient-1" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(deletePatientForNurse("nurse-1", "patient-1")).resolves.toEqual({
      id: "patient-1",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("returns null when delete query removes nothing", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    getDbMock.mockReturnValue({ update: updateMock });

    await expect(deletePatientForNurse("nurse-1", "missing")).resolves.toBeNull();
  });
});
