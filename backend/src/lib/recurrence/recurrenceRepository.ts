import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type {
  CreateRecurringVisitTemplateRequest,
  OptimizeRouteV2Visit,
  UpdateRecurringVisitTemplateRequest,
} from "../../../../shared/contracts";
import { getDb } from "../../db";
import {
  patients,
  recurringVisitTemplateWindows,
  recurringVisitTemplates,
  visitInstances,
} from "../../db/schema";
import { HttpError } from "../http";
import type {
  ExpandVisitInstancesPayload,
  UpdateVisitInstancePayload,
} from "./recurrenceValidation";

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_TOKEN_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

type RecurrenceRule = {
  frequency: "daily" | "weekly";
  interval: number;
  byDays: Set<number> | null;
};

type TemplateWindowRow = typeof recurringVisitTemplateWindows.$inferSelect;
type TemplateRow = typeof recurringVisitTemplates.$inferSelect;
type VisitInstanceRow = typeof visitInstances.$inferSelect;

export type RecurringTemplateWithWindows = TemplateRow & {
  windows: TemplateWindowRow[];
};

const runInTransaction = async <T>(operation: (db: ReturnType<typeof getDb>) => Promise<T>) => {
  const db = getDb();
  const transactionalDb = db as unknown as {
    transaction?: (fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  if (typeof transactionalDb.transaction === "function") {
    return transactionalDb.transaction((transaction) =>
      operation(transaction as ReturnType<typeof getDb>),
    );
  }

  return operation(db);
};

const isUniqueViolationError = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === "23505";
};

const attachTemplateWindows = async (
  templates: TemplateRow[],
): Promise<RecurringTemplateWithWindows[]> => {
  if (templates.length === 0) {
    return [];
  }

  const templateIds = templates.map((template) => template.id);
  const windows = await getDb()
    .select()
    .from(recurringVisitTemplateWindows)
    .where(inArray(recurringVisitTemplateWindows.templateId, templateIds))
    .orderBy(
      asc(recurringVisitTemplateWindows.dayOfWeek),
      asc(recurringVisitTemplateWindows.startTime),
      asc(recurringVisitTemplateWindows.endTime),
    );

  const windowsByTemplateId = new Map<string, TemplateWindowRow[]>();
  windows.forEach((window) => {
    const existing = windowsByTemplateId.get(window.templateId) ?? [];
    existing.push(window);
    windowsByTemplateId.set(window.templateId, existing);
  });

  return templates.map((template) => ({
    ...template,
    windows: windowsByTemplateId.get(template.id) ?? [],
  }));
};

const findActiveClientForNurse = async (nurseId: string, patientId: string) => {
  const [patient] = await getDb()
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(eq(patients.id, patientId), eq(patients.nurseId, nurseId), eq(patients.isActive, true)),
    )
    .limit(1);

  return patient ?? null;
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toDateString = (value: Date) => value.toISOString().slice(0, 10);
const dayOfWeekForDate = (dateString: string) =>
  new Date(`${dateString}T12:00:00.000Z`).getUTCDay();

const parseRecurrenceRule = (rule: string): RecurrenceRule => {
  const tokens = rule
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  let frequency: "daily" | "weekly" = "weekly";
  let interval = 1;
  let byDays: Set<number> | null = null;

  tokens.forEach((token) => {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = token.slice(0, separatorIndex).trim().toUpperCase();
    const value = token
      .slice(separatorIndex + 1)
      .trim()
      .toUpperCase();

    if (key === "FREQ") {
      if (value === "DAILY") {
        frequency = "daily";
      } else if (value === "WEEKLY") {
        frequency = "weekly";
      }
      return;
    }

    if (key === "INTERVAL") {
      const parsedInterval = Number(value);
      if (Number.isInteger(parsedInterval) && parsedInterval > 0) {
        interval = parsedInterval;
      }
      return;
    }

    if (key === "BYDAY") {
      const days = value
        .split(",")
        .map((dayToken) => DAY_TOKEN_TO_INDEX[dayToken])
        .filter((dayIndex): dayIndex is number => dayIndex !== undefined);

      byDays = days.length > 0 ? new Set(days) : null;
    }
  });

  return { frequency, interval, byDays };
};

const isDateEligibleForTemplate = (
  template: RecurringTemplateWithWindows,
  planningDate: string,
  parsedRule: RecurrenceRule,
) => {
  if (planningDate < template.startDate) {
    return false;
  }

  if (template.endDate && planningDate > template.endDate) {
    return false;
  }

  const dayDifference = Math.floor(
    (toDate(planningDate).getTime() - toDate(template.startDate).getTime()) / DAY_MS,
  );
  if (dayDifference < 0) {
    return false;
  }

  if (parsedRule.frequency === "daily") {
    if (dayDifference % parsedRule.interval !== 0) {
      return false;
    }
  } else {
    const weekOffset = Math.floor(dayDifference / 7);
    if (weekOffset % parsedRule.interval !== 0) {
      return false;
    }
  }

  if (parsedRule.byDays && !parsedRule.byDays.has(dayOfWeekForDate(planningDate))) {
    return false;
  }

  return true;
};

const toOccurrenceKey = (templateId: string, windowId: string, planningDate: string) =>
  `${templateId}:${windowId}:${planningDate}`;

const listClientAddressesByIds = async (nurseId: string, patientIds: string[]) => {
  if (patientIds.length === 0) {
    return new Map<string, { address: string; googlePlaceId: string | null }>();
  }

  const rows = await getDb()
    .select({ id: patients.id, address: patients.address, googlePlaceId: patients.googlePlaceId })
    .from(patients)
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, true),
        inArray(patients.id, patientIds),
      ),
    );

  return new Map(
    rows.map((row) => [row.id, { address: row.address, googlePlaceId: row.googlePlaceId }]),
  );
};

const listVisitInstanceRowsForRange = async (
  nurseId: string,
  startDate: string,
  endDate: string,
  templateIds?: string[],
) => {
  const baseCondition = and(
    eq(visitInstances.nurseId, nurseId),
    gte(visitInstances.planningDate, startDate),
    lte(visitInstances.planningDate, endDate),
  );

  const whereCondition =
    templateIds && templateIds.length > 0
      ? and(baseCondition, inArray(visitInstances.templateId, templateIds))
      : baseCondition;

  return getDb()
    .select()
    .from(visitInstances)
    .where(whereCondition)
    .orderBy(
      asc(visitInstances.planningDate),
      asc(visitInstances.windowStart),
      asc(visitInstances.windowEnd),
      asc(visitInstances.createdAt),
    );
};

const toHourMinute = (value: string) => value.slice(0, 5);
const toMinutes = (value: string) => {
  const [hourString, minuteString] = value.split(":");
  return Number(hourString) * 60 + Number(minuteString);
};

export const listRecurringVisitTemplatesByNurse = async (nurseId: string, patientId?: string) => {
  const whereCondition = patientId
    ? and(
        eq(recurringVisitTemplates.nurseId, nurseId),
        eq(recurringVisitTemplates.patientId, patientId),
      )
    : eq(recurringVisitTemplates.nurseId, nurseId);

  const templates = await getDb()
    .select()
    .from(recurringVisitTemplates)
    .where(whereCondition)
    .orderBy(asc(recurringVisitTemplates.createdAt));

  return attachTemplateWindows(templates);
};

export const findRecurringVisitTemplateByIdForNurse = async (
  nurseId: string,
  templateId: string,
) => {
  const [template] = await getDb()
    .select()
    .from(recurringVisitTemplates)
    .where(
      and(eq(recurringVisitTemplates.id, templateId), eq(recurringVisitTemplates.nurseId, nurseId)),
    )
    .limit(1);

  if (!template) {
    return null;
  }

  const [withWindows] = await attachTemplateWindows([template]);
  return withWindows ?? null;
};

export const createRecurringVisitTemplateForNurse = async (
  nurseId: string,
  payload: CreateRecurringVisitTemplateRequest,
) => {
  const client = await findActiveClientForNurse(nurseId, payload.patientId);
  if (!client) {
    throw new HttpError(404, "Client not found.");
  }

  return runInTransaction(async (transaction) => {
    const [template] = await transaction
      .insert(recurringVisitTemplates)
      .values({
        nurseId,
        patientId: payload.patientId,
        name: payload.name ?? null,
        timezone: payload.timezone,
        recurrenceRule: payload.recurrenceRule,
        startDate: payload.startDate,
        endDate: payload.endDate ?? null,
        serviceDurationMinutes: payload.serviceDurationMinutes,
      })
      .returning();

    const windows = await transaction
      .insert(recurringVisitTemplateWindows)
      .values(
        payload.windows.map((window) => ({
          templateId: template.id,
          dayOfWeek: window.dayOfWeek,
          startTime: window.startTime,
          endTime: window.endTime,
          visitTimeType: window.visitTimeType,
        })),
      )
      .returning();

    return {
      ...template,
      windows,
    };
  });
};

export const updateRecurringVisitTemplateForNurse = async (
  nurseId: string,
  templateId: string,
  payload: UpdateRecurringVisitTemplateRequest,
) => {
  const existing = await findRecurringVisitTemplateByIdForNurse(nurseId, templateId);
  if (!existing) {
    return null;
  }

  const nextPatientId = payload.patientId ?? existing.patientId;
  if (payload.patientId !== undefined) {
    const client = await findActiveClientForNurse(nurseId, nextPatientId);
    if (!client) {
      throw new HttpError(404, "Client not found.");
    }
  }

  const nextStartDate = payload.startDate ?? existing.startDate;
  const nextEndDate = payload.endDate === undefined ? existing.endDate : payload.endDate;
  if (nextEndDate !== null && nextEndDate < nextStartDate) {
    throw new HttpError(400, "endDate must be on or after startDate.");
  }

  return runInTransaction(async (transaction) => {
    const [updatedTemplate] = await transaction
      .update(recurringVisitTemplates)
      .set({
        ...(payload.patientId !== undefined ? { patientId: payload.patientId } : {}),
        ...(payload.name !== undefined ? { name: payload.name ?? null } : {}),
        ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
        ...(payload.recurrenceRule !== undefined ? { recurrenceRule: payload.recurrenceRule } : {}),
        ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate ?? null } : {}),
        ...(payload.serviceDurationMinutes !== undefined
          ? { serviceDurationMinutes: payload.serviceDurationMinutes }
          : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recurringVisitTemplates.id, templateId),
          eq(recurringVisitTemplates.nurseId, nurseId),
        ),
      )
      .returning();

    if (!updatedTemplate) {
      return null;
    }

    const windowsPayload = payload.windows;
    const nextWindows =
      windowsPayload !== undefined
        ? await (async () => {
            await transaction
              .delete(recurringVisitTemplateWindows)
              .where(eq(recurringVisitTemplateWindows.templateId, updatedTemplate.id));

            if (windowsPayload.length === 0) {
              return [] as TemplateWindowRow[];
            }

            return transaction
              .insert(recurringVisitTemplateWindows)
              .values(
                windowsPayload.map((window) => ({
                  templateId: updatedTemplate.id,
                  dayOfWeek: window.dayOfWeek,
                  startTime: window.startTime,
                  endTime: window.endTime,
                  visitTimeType: window.visitTimeType,
                })),
              )
              .returning();
          })()
        : existing.windows;

    return {
      ...updatedTemplate,
      windows: nextWindows,
    };
  });
};

export const deleteRecurringVisitTemplateForNurse = async (nurseId: string, templateId: string) => {
  const [deleted] = await getDb()
    .delete(recurringVisitTemplates)
    .where(
      and(eq(recurringVisitTemplates.id, templateId), eq(recurringVisitTemplates.nurseId, nurseId)),
    )
    .returning({ id: recurringVisitTemplates.id });

  return deleted ?? null;
};

export const listVisitInstancesByNurseInRange = async (
  nurseId: string,
  startDate: string,
  endDate: string,
  templateIds?: string[],
) => listVisitInstanceRowsForRange(nurseId, startDate, endDate, templateIds);

type ExpandVisitInstancesResult = {
  createdCount: number;
  instances: VisitInstanceRow[];
};

const enumerateDateRange = (startDate: string, endDate: string) => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const dates: string[] = [];

  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
    dates.push(toDateString(new Date(cursor)));
  }

  return dates;
};

export const expandVisitInstancesForNurse = async (
  nurseId: string,
  payload: ExpandVisitInstancesPayload,
): Promise<ExpandVisitInstancesResult> => {
  const templates = await listRecurringVisitTemplatesByNurse(nurseId);
  const templateIdFilter = payload.templateIds ? new Set(payload.templateIds) : null;

  const filteredTemplates = templates.filter((template) => {
    if (!template.isActive) {
      return false;
    }
    if (templateIdFilter && !templateIdFilter.has(template.id)) {
      return false;
    }
    return true;
  });

  if (filteredTemplates.length === 0) {
    return {
      createdCount: 0,
      instances: await listVisitInstanceRowsForRange(
        nurseId,
        payload.startDate,
        payload.endDate,
        payload.templateIds,
      ),
    };
  }

  const clientAddresses = await listClientAddressesByIds(
    nurseId,
    Array.from(new Set(filteredTemplates.map((template) => template.patientId))),
  );

  const candidateInsertRows: (typeof visitInstances.$inferInsert)[] = [];
  const dateRange = enumerateDateRange(payload.startDate, payload.endDate);

  filteredTemplates.forEach((template) => {
    const clientAddress = clientAddresses.get(template.patientId);
    if (!clientAddress) {
      return;
    }

    const parsedRule = parseRecurrenceRule(template.recurrenceRule);

    dateRange.forEach((planningDate) => {
      if (!isDateEligibleForTemplate(template, planningDate, parsedRule)) {
        return;
      }

      const dayOfWeek = dayOfWeekForDate(planningDate);
      const matchingWindows = template.windows.filter((window) => window.dayOfWeek === dayOfWeek);

      matchingWindows.forEach((window) => {
        candidateInsertRows.push({
          nurseId,
          patientId: template.patientId,
          templateId: template.id,
          occurrenceKey: toOccurrenceKey(template.id, window.id, planningDate),
          planningDate,
          address: clientAddress.address,
          googlePlaceId: clientAddress.googlePlaceId,
          windowStart: window.startTime,
          windowEnd: window.endTime,
          visitTimeType: window.visitTimeType,
          serviceDurationMinutes: template.serviceDurationMinutes,
          status: "scheduled",
          isManualOverride: false,
        });
      });
    });
  });

  if (candidateInsertRows.length === 0) {
    return {
      createdCount: 0,
      instances: await listVisitInstanceRowsForRange(
        nurseId,
        payload.startDate,
        payload.endDate,
        payload.templateIds,
      ),
    };
  }

  const occurrenceKeys = candidateInsertRows.map((row) => row.occurrenceKey);
  const existingRows = await getDb()
    .select({ occurrenceKey: visitInstances.occurrenceKey })
    .from(visitInstances)
    .where(
      and(
        eq(visitInstances.nurseId, nurseId),
        inArray(visitInstances.occurrenceKey, occurrenceKeys),
      ),
    );

  const existingKeys = new Set(existingRows.map((row) => row.occurrenceKey));
  const insertRows = candidateInsertRows.filter((row) => !existingKeys.has(row.occurrenceKey));

  if (insertRows.length > 0) {
    try {
      await getDb().insert(visitInstances).values(insertRows);
    } catch (error) {
      if (!isUniqueViolationError(error)) {
        throw error;
      }
    }
  }

  return {
    createdCount: insertRows.length,
    instances: await listVisitInstanceRowsForRange(
      nurseId,
      payload.startDate,
      payload.endDate,
      payload.templateIds,
    ),
  };
};

export const updateVisitInstanceForNurse = async (
  nurseId: string,
  instanceId: string,
  payload: UpdateVisitInstancePayload,
) => {
  const [existing] = await getDb()
    .select()
    .from(visitInstances)
    .where(and(eq(visitInstances.id, instanceId), eq(visitInstances.nurseId, nurseId)))
    .limit(1);

  if (!existing) {
    return null;
  }

  const effectiveWindowStart = payload.windowStart ?? toHourMinute(existing.windowStart);
  const effectiveWindowEnd = payload.windowEnd ?? toHourMinute(existing.windowEnd);
  if (toMinutes(effectiveWindowEnd) <= toMinutes(effectiveWindowStart)) {
    throw new HttpError(400, "windowEnd must be later than windowStart.");
  }

  const scheduleFieldsTouched =
    payload.planningDate !== undefined ||
    payload.address !== undefined ||
    payload.googlePlaceId !== undefined ||
    payload.windowStart !== undefined ||
    payload.windowEnd !== undefined ||
    payload.visitTimeType !== undefined ||
    payload.serviceDurationMinutes !== undefined ||
    payload.status !== undefined;

  const [updated] = await getDb()
    .update(visitInstances)
    .set({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.planningDate !== undefined ? { planningDate: payload.planningDate } : {}),
      ...(payload.address !== undefined ? { address: payload.address } : {}),
      ...(payload.googlePlaceId !== undefined ? { googlePlaceId: payload.googlePlaceId } : {}),
      ...(payload.windowStart !== undefined ? { windowStart: payload.windowStart } : {}),
      ...(payload.windowEnd !== undefined ? { windowEnd: payload.windowEnd } : {}),
      ...(payload.visitTimeType !== undefined ? { visitTimeType: payload.visitTimeType } : {}),
      ...(payload.serviceDurationMinutes !== undefined
        ? { serviceDurationMinutes: payload.serviceDurationMinutes }
        : {}),
      ...(scheduleFieldsTouched ? { isManualOverride: true } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(visitInstances.id, instanceId), eq(visitInstances.nurseId, nurseId)))
    .returning();

  return updated ?? null;
};

export type VisitInstanceMeta = {
  instanceId: string;
  templateId: string | null;
};

export const listScheduledVisitInstancesForOptimization = async (
  nurseId: string,
  planningDate: string,
): Promise<{
  visits: OptimizeRouteV2Visit[];
  instanceMetaByVisitId: Map<string, VisitInstanceMeta>;
}> => {
  const rows = await getDb()
    .select({
      id: visitInstances.id,
      templateId: visitInstances.templateId,
      patientId: visitInstances.patientId,
      address: visitInstances.address,
      googlePlaceId: visitInstances.googlePlaceId,
      windowStart: visitInstances.windowStart,
      windowEnd: visitInstances.windowEnd,
      visitTimeType: visitInstances.visitTimeType,
      serviceDurationMinutes: visitInstances.serviceDurationMinutes,
      firstName: patients.firstName,
      lastName: patients.lastName,
    })
    .from(visitInstances)
    .innerJoin(patients, eq(visitInstances.patientId, patients.id))
    .where(
      and(
        eq(visitInstances.nurseId, nurseId),
        eq(visitInstances.planningDate, planningDate),
        eq(visitInstances.status, "scheduled"),
        eq(patients.isActive, true),
      ),
    )
    .orderBy(asc(visitInstances.windowStart), asc(visitInstances.createdAt));

  const visits: OptimizeRouteV2Visit[] = rows.map((row) => ({
    visitId: row.id,
    patientId: row.patientId,
    patientName: `${row.firstName} ${row.lastName}`.trim(),
    address: row.address,
    googlePlaceId: row.googlePlaceId,
    windowStart: toHourMinute(row.windowStart),
    windowEnd: toHourMinute(row.windowEnd),
    windowType: row.visitTimeType === "flexible" ? "flexible" : "fixed",
    serviceDurationMinutes: row.serviceDurationMinutes,
  }));

  const instanceMetaByVisitId = new Map<string, VisitInstanceMeta>(
    rows.map((row) => [row.id, { instanceId: row.id, templateId: row.templateId }]),
  );

  return { visits, instanceMetaByVisitId };
};
