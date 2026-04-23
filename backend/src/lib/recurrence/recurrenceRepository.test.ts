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

const makeWindow = (overrides: Record<string, unknown> = {}) => ({
  id: "window-1",
  templateId: "tpl-1",
  dayOfWeek: 1,
  startTime: "09:00:00",
  endTime: "10:00:00",
  visitTimeType: "fixed",
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
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]));

    await expect(listRecurringVisitTemplatesByNurse("nurse-1", "client-1")).resolves.toEqual([
      expect.objectContaining({
        id: "tpl-1",
        windows: [expect.objectContaining({ id: "window-1" })],
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
            returning: vi.fn().mockResolvedValue([makeWindow()]),
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
        serviceDurationMinutes: 30,
        windows: [
          {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "10:00",
            visitTimeType: "fixed",
          },
        ],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "tpl-1", windows: [expect.any(Object)] }));
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
        serviceDurationMinutes: 30,
        windows: [expect.any(Object) as never],
      }),
    ).rejects.toThrow("Client not found.");
  });

  it("updates template windows and validates effective date ranges", async () => {
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
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([makeWindow({ id: "window-2" })]),
        }),
      }),
    };

    getDbMock
      .mockReturnValueOnce(selectLimitDb([existing]))
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]))
      .mockReturnValueOnce({
        transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
      });

    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "tpl-1", {
        name: "Updated",
        endDate: "2026-06-30",
        windows: [
          { dayOfWeek: 2, startTime: "11:00", endTime: "12:00", visitTimeType: "flexible" },
        ],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: "Updated",
        windows: [expect.objectContaining({ id: "window-2" })],
      }),
    );

    getDbMock.mockReset();
    getDbMock
      .mockReturnValueOnce(selectLimitDb([existing]))
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]));

    await expect(
      updateRecurringVisitTemplateForNurse("nurse-1", "tpl-1", {
        startDate: "2026-07-01",
      }),
    ).rejects.toThrow("endDate must be on or after startDate.");
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

  it("expands eligible weekly template windows and skips duplicate occurrence keys", async () => {
    let insertedRows: unknown;
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate()]))
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]))
      .mockReturnValueOnce(
        selectWhereDb([{ id: "client-1", address: "123 Main St", googlePlaceId: "place-1" }]),
      )
      .mockReturnValueOnce(selectWhereDb([]))
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
      createdCount: 2,
      instances: [expect.objectContaining({ id: "inst-1" })],
    });
    expect(insertedRows).toEqual([
      expect.objectContaining({ occurrenceKey: "tpl-1:window-1:2026-05-04" }),
      expect.objectContaining({ occurrenceKey: "tpl-1:window-1:2026-05-11" }),
    ]);
  });

  it("returns existing instances when expansion has no active templates or candidates", async () => {
    getDbMock
      .mockReturnValueOnce(selectOrderByDb([makeTemplate({ isActive: false })]))
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]))
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
      .mockReturnValueOnce(selectOrderByDb([makeWindow({ dayOfWeek: 2 })]))
      .mockReturnValueOnce(
        selectWhereDb([{ id: "client-1", address: "123 Main St", googlePlaceId: null }]),
      )
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
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]))
      .mockReturnValueOnce(
        selectWhereDb([{ id: "client-1", address: "123 Main St", googlePlaceId: null }]),
      )
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
      .mockReturnValueOnce(selectOrderByDb([makeWindow()]))
      .mockReturnValueOnce(
        selectWhereDb([{ id: "client-1", address: "123 Main St", googlePlaceId: null }]),
      )
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
