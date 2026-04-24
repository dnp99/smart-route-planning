import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../http";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDb: getDbMock,
}));

import {
  createRecurringVisitTemplateForNurse,
  deleteRecurringVisitTemplateForNurse,
  expandVisitInstancesForNurse,
  findRecurringVisitTemplateByIdForNurse,
  listRecurringVisitTemplatesByNurse,
  listScheduledVisitInstancesForOptimization,
  updateRecurringVisitTemplateForNurse,
  updateVisitInstanceForNurse,
} from "./recurrenceRepository";

const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: "tpl-1",
  nurseId: "nurse-1",
  patientId: "client-1",
  name: "Monday",
  timezone: "America/Toronto",
  recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  startDate: "2026-05-04",
  endDate: null,
  serviceDurationMinutes: 30,
  isActive: true,
  createdAt: new Date("2026-05-01T12:00:00.000Z"),
  updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  ...overrides,
});

const makeDay = (overrides: Record<string, unknown> = {}) => ({
  id: "day-1",
  templateId: "tpl-1",
  dayOfWeek: 1,
  createdAt: new Date("2026-05-01T12:00:00.000Z"),
  updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  ...overrides,
});

const makePatientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "client-1",
  address: "123 Main St",
  googlePlaceId: "place-1",
  visitDurationMinutes: 45,
  preferredVisitStartTime: "11:00:00",
  preferredVisitEndTime: "12:00:00",
  visitTimeType: "flexible",
  ...overrides,
});

const makePatientWindow = (overrides: Record<string, unknown> = {}) => ({
  id: "patient-window-1",
  patientId: "client-1",
  startTime: "11:00:00",
  endTime: "12:00:00",
  visitTimeType: "flexible",
  createdAt: new Date("2026-05-01T12:00:00.000Z"),
  updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  ...overrides,
});

const makeInstance = (overrides: Record<string, unknown> = {}) => ({
  id: "inst-1",
  nurseId: "nurse-1",
  patientId: "client-1",
  templateId: "tpl-1",
  occurrenceKey: "tpl-1:window-1:2026-05-04",
  planningDate: "2026-05-04",
  address: "123 Main St",
  googlePlaceId: "place-1",
  windowStart: "09:00:00",
  windowEnd: "10:00:00",
  visitTimeType: "fixed",
  serviceDurationMinutes: 30,
  status: "scheduled",
  isManualOverride: false,
  createdAt: new Date("2026-05-01T12:00:00.000Z"),
  updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  ...overrides,
});

const selectOrderByDb = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

const selectLimitDb = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

const selectWhereDb = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const insertValuesDb = (onValues?: (rows: unknown) => void, error?: unknown) => ({
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((rows: unknown) => {
      onValues?.(rows);
      if (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(undefined);
    }),
  }),
});

const updateReturningDb = (rows: unknown[], onSet?: (value: unknown) => void) => ({
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockImplementation((value: unknown) => {
      onSet?.(value);
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(rows),
        }),
      };
    }),
  }),
});

describe("recurrenceRepository", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("lists templates with attached windows and optional client filtering", async () => {
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]));

    await expect(listRecurringVisitTemplatesByNurse("nurse-1", "client-1")).resolves.toEqual([
      expect.objectContaining({
        id: "tpl-1",
        daysOfWeek: [1],
        days: [expect.objectContaining({ id: "day-1" })],
      }),
    ]);
  });

  it("returns null when a template cannot be found", async () => {
    getDbMock.mockReturnValueOnce(selectLimitDb([]));

    await expect(findRecurringVisitTemplateByIdForNurse("nurse-1", "missing")).resolves.toBeNull();
  });

  it("creates templates in a transaction and verifies the client first", async () => {
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeTemplate()]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeDay()]),
          }),
        }),
    };
    const transaction = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));

    getDbMock
      .mockReturnValueOnce(selectLimitDb([{ id: "client-1" }]))
      .mockReturnValueOnce({ transaction });

    await expect(
      createRecurringVisitTemplateForNurse("nurse-1", {
        patientId: "client-1",
        name: null,
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        startDate: "2026-05-04",
        endDate: null,
        daysOfWeek: [1],
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: "tpl-1", daysOfWeek: [1], days: [expect.any(Object)] }),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects template creation when the client is missing", async () => {
    getDbMock.mockReturnValueOnce(selectLimitDb([]));

    await expect(
      createRecurringVisitTemplateForNurse("nurse-1", {
        patientId: "missing",
        name: null,
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        startDate: "2026-05-04",
        endDate: null,
        daysOfWeek: [1],
      }),
    ).rejects.toThrow("Client not found.");
  });

  it("updates template schedule and validates effective date ranges", async () => {
    const existing = makeTemplate({ endDate: "2026-05-31" });
    const updated = makeTemplate({ name: "Updated", endDate: "2026-06-30" });
    const tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeDay({ id: "day-2", dayOfWeek: 2 })]),
          }),
        }),
    };

    getDbMock
      .mockReturnValueOnce(selectLimitDb([existing]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce({
        transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
      });

    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "tpl-1", {
        name: "Updated",
        endDate: "2026-06-30",
        daysOfWeek: [2],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: "Updated",
        daysOfWeek: [2],
        days: [expect.objectContaining({ id: "day-2" })],
      }),
    );

    getDbMock.mockReset();
    getDbMock
      .mockReturnValueOnce(selectLimitDb([existing]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]));

    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "tpl-1", {
        startDate: "2026-07-01",
      }),
    ).rejects.toThrow("endDate must be on or after startDate.");
  });

  it("cancels non-manual future generated instances when template end date is shortened", async () => {
    const existing = makeTemplate({ endDate: null });
    const updated = makeTemplate({ endDate: "2026-05-20" });
    let cancelledUpdateSet: unknown;
    const cancelWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updated]),
            }),
          }),
        })
        .mockReturnValueOnce({
          set: vi.fn().mockImplementation((value: unknown) => {
            cancelledUpdateSet = value;
            return {
              where: cancelWhere,
            };
          }),
        }),
    };

    getDbMock
      .mockReturnValueOnce(selectLimitDb([existing]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce({
        transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
      });

    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "tpl-1", {
        endDate: "2026-05-20",
      }),
    ).resolves.toEqual(expect.objectContaining({ endDate: "2026-05-20" }));

    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(cancelledUpdateSet).toEqual(
      expect.objectContaining({
        status: "cancelled",
        updatedAt: expect.any(Date),
      }),
    );
    expect(cancelWhere).toHaveBeenCalledTimes(1);
  });

  it("returns null for missing updates and deletes", async () => {
    getDbMock.mockReturnValueOnce(selectLimitDb([]));
    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "missing", {}),
    ).resolves.toBeNull();

    getDbMock.mockReturnValueOnce({
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(tx);
      }),
    });
    await expect(deleteRecurringVisitTemplateForNurse("nurse-1", "missing")).resolves.toBeNull();
  });

  it("deletes generated visit instances before deleting the template", async () => {
    const deleteVisitInstancesWhere = vi.fn().mockResolvedValue(undefined);
    const deleteTemplateReturning = vi.fn().mockResolvedValue([{ id: "tpl-1" }]);
    const deleteTemplateWhere = vi.fn().mockReturnValue({
      returning: deleteTemplateReturning,
    });
    const tx = {
      delete: vi
        .fn()
        .mockReturnValueOnce({
          where: deleteVisitInstancesWhere,
        })
        .mockReturnValueOnce({
          where: deleteTemplateWhere,
        }),
    };

    getDbMock.mockReturnValueOnce({
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    });

    await expect(deleteRecurringVisitTemplateForNurse("nurse-1", "tpl-1")).resolves.toEqual({
      id: "tpl-1",
    });

    expect(tx.delete).toHaveBeenCalledTimes(2);
    expect(deleteVisitInstancesWhere).toHaveBeenCalledTimes(1);
    expect(deleteTemplateWhere).toHaveBeenCalledTimes(1);
    expect(deleteTemplateReturning).toHaveBeenCalledTimes(1);
    expect(deleteVisitInstancesWhere.mock.invocationCallOrder[0]).toBeLessThan(
      deleteTemplateWhere.mock.invocationCallOrder[0],
    );
  });

  it("expands eligible weekly template windows and skips existing occurrence keys", async () => {
    let insertedRows: unknown;
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow()]))
      .mockReturnValueOnce(selectOrderByDb([makePatientWindow()]))
      .mockReturnValueOnce(
        selectWhereDb([{ occurrenceKey: "tpl-1:patient-window-1:2026-05-04" }]),
      )
      .mockReturnValueOnce(
        insertValuesDb((rows) => {
          insertedRows = rows;
        }),
      )
      .mockReturnValueOnce(selectOrderByDb([makeInstance()]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-11",
      }),
    ).resolves.toEqual({
      createdCount: 1,
      instances: [expect.objectContaining({ id: "inst-1" })],
    });
    expect(insertedRows).toEqual([
      expect.objectContaining({ occurrenceKey: "tpl-1:patient-window-1:2026-05-11" }),
    ]);
  });

  it("expands one instance per client visit window on the same planning date", async () => {
    let insertedRows: unknown;
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow()]))
      .mockReturnValueOnce(
        selectOrderByDb([
          makePatientWindow(),
          makePatientWindow({
            id: "patient-window-2",
            startTime: "13:00:00",
            endTime: "14:00:00",
          }),
        ]),
      )
      .mockReturnValueOnce(selectWhereDb([]))
      .mockReturnValueOnce(
        insertValuesDb((rows) => {
          insertedRows = rows;
        }),
      )
      .mockReturnValueOnce(
        selectOrderByDb([
          makeInstance({
            occurrenceKey: "tpl-1:patient-window-1:2026-05-04",
            windowStart: "11:00:00",
            windowEnd: "12:00:00",
            visitTimeType: "flexible",
            serviceDurationMinutes: 45,
          }),
          makeInstance({
            id: "inst-2",
            occurrenceKey: "tpl-1:patient-window-2:2026-05-04",
            windowStart: "13:00:00",
            windowEnd: "14:00:00",
            visitTimeType: "flexible",
            serviceDurationMinutes: 45,
          }),
        ]),
      );

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-04",
      }),
    ).resolves.toEqual({
      createdCount: 2,
      instances: [
        expect.objectContaining({ id: "inst-1" }),
        expect.objectContaining({ id: "inst-2" }),
      ],
    });

    expect(insertedRows).toEqual([
      expect.objectContaining({
        occurrenceKey: "tpl-1:patient-window-1:2026-05-04",
        windowStart: "11:00:00",
        windowEnd: "12:00:00",
      }),
      expect.objectContaining({
        occurrenceKey: "tpl-1:patient-window-2:2026-05-04",
        windowStart: "13:00:00",
        windowEnd: "14:00:00",
      }),
    ]);
  });

  it("skips planning dates whose weekday is not selected on the template", async () => {
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate({ recurrenceRule: "FREQ=DAILY;INTERVAL=1" })]))
      .mockReturnValueOnce(selectOrderByDb([makeDay({ dayOfWeek: 1 })]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow()]))
      .mockReturnValueOnce(selectOrderByDb([makePatientWindow()]))
      .mockReturnValueOnce(selectOrderByDb([]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-05",
        endDate: "2026-05-05",
      }),
    ).resolves.toEqual({ createdCount: 0, instances: [] });
  });

  it("falls back to the client legacy preferred window when no visit windows exist", async () => {
    let insertedRows: unknown;
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow({ googlePlaceId: null })]))
      .mockReturnValueOnce(selectOrderByDb([]))
      .mockReturnValueOnce(selectWhereDb([]))
      .mockReturnValueOnce(
        insertValuesDb((rows) => {
          insertedRows = rows;
        }),
      )
      .mockReturnValueOnce(selectOrderByDb([]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-04",
      }),
    ).resolves.toEqual({ createdCount: 1, instances: [] });

    expect(insertedRows).toEqual([
      expect.objectContaining({
        occurrenceKey: "tpl-1:client-1-legacy:2026-05-04",
        windowStart: "11:00:00",
        windowEnd: "12:00:00",
        visitTimeType: "flexible",
        serviceDurationMinutes: 45,
        googlePlaceId: null,
      }),
    ]);
  });

  it("returns existing instances when expansion has no active templates or candidates", async () => {
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate({ isActive: false })]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectOrderByDb([makeInstance()]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-04",
        templateIds: ["tpl-1"],
      }),
    ).resolves.toEqual({ createdCount: 0, instances: [expect.objectContaining({ id: "inst-1" })] });

    getDbMock.mockReset();
    getDbMock
      .mockReturnValueOnce(
        selectOrderByDb([makeTemplate({ recurrenceRule: "FREQ=DAILY;INTERVAL=2" })]),
      )
      .mockReturnValueOnce(selectOrderByDb([makeDay({ dayOfWeek: 2 })]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow({ googlePlaceId: null })]))
      .mockReturnValueOnce(selectOrderByDb([makePatientWindow()]))
      .mockReturnValueOnce(selectOrderByDb([]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-05",
        endDate: "2026-05-05",
      }),
    ).resolves.toEqual({ createdCount: 0, instances: [] });
  });

  it("swallows unique insert races but rethrows other insert errors", async () => {
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow({ googlePlaceId: null })]))
      .mockReturnValueOnce(selectOrderByDb([makePatientWindow()]))
      .mockReturnValueOnce(selectWhereDb([]))
      .mockReturnValueOnce(insertValuesDb(undefined, { code: "23505" }))
      .mockReturnValueOnce(selectOrderByDb([]));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-04",
      }),
    ).resolves.toEqual({ createdCount: 1, instances: [] });

    getDbMock.mockReset();
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeDay()]))
      .mockReturnValueOnce(selectWhereDb([makePatientRow({ googlePlaceId: null })]))
      .mockReturnValueOnce(selectOrderByDb([makePatientWindow()]))
      .mockReturnValueOnce(selectWhereDb([]))
      .mockReturnValueOnce(insertValuesDb(undefined, new Error("db down")));

    await expect(
      expandVisitInstancesForNurse("nurse-1", {
        startDate: "2026-05-04",
        endDate: "2026-05-04",
      }),
    ).rejects.toThrow("db down");
  });

  it("updates visit instances, marks schedule overrides, and validates windows", async () => {
    let updateSet: unknown;
    getDbMock.mockReturnValueOnce(selectLimitDb([makeInstance()])).mockReturnValueOnce(
      updateReturningDb([makeInstance({ status: "cancelled" })], (value) => {
        updateSet = value;
      }),
    );

    await expect(
      updateVisitInstanceForNurse("nurse-1", "inst-1", { status: "cancelled" }),
    ).resolves.toEqual(expect.objectContaining({ status: "cancelled" }));
    expect(updateSet).toEqual(
      expect.objectContaining({ status: "cancelled", isManualOverride: true }),
    );

    getDbMock.mockReset();
    getDbMock.mockReturnValueOnce(selectLimitDb([makeInstance({ windowStart: "10:00:00" })]));
    await expect(
      updateVisitInstanceForNurse("nurse-1", "inst-1", { windowEnd: "09:00" }),
    ).rejects.toBeInstanceOf(HttpError);

    getDbMock.mockReset();
    getDbMock.mockReturnValueOnce(selectLimitDb([]));
    await expect(updateVisitInstanceForNurse("nurse-1", "missing", {})).resolves.toBeNull();
  });

  it("lists scheduled visit instances for optimization with metadata", async () => {
    getDbMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "inst-1",
                  templateId: "tpl-1",
                  patientId: "client-1",
                  address: "123 Main St",
                  googlePlaceId: null,
                  windowStart: "09:00:00",
                  windowEnd: "10:00:00",
                  visitTimeType: "flexible",
                  serviceDurationMinutes: 30,
                  firstName: "Ada",
                  lastName: "Lovelace",
                },
              ]),
            }),
          }),
        }),
      }),
    });

    await expect(
      listScheduledVisitInstancesForOptimization("nurse-1", "2026-05-04"),
    ).resolves.toEqual({
      visits: [
        {
          visitId: "inst-1",
          patientId: "client-1",
          patientName: "Ada Lovelace",
          address: "123 Main St",
          googlePlaceId: null,
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "flexible",
          serviceDurationMinutes: 30,
        },
      ],
      instanceMetaByVisitId: new Map([["inst-1", { instanceId: "inst-1", templateId: "tpl-1" }]]),
    });
  });
});
