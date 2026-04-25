import { and, asc, eq, gt, gte, inArray, lte, or } from "drizzle-orm";
import type {
  CreateRecurringVisitTemplateRequest,
  OptimizeRouteV2Visit,
  UpdateRecurringVisitTemplateRequest,
} from "../../../../shared/contracts";
import { getDb } from "../../db";
import {
  patientVisitWindows,
  patients,
  recurringVisitTemplateDays,
  recurringVisitTemplates,
  visitInstanceExceptions,
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

type TemplateDayRow = typeof recurringVisitTemplateDays.$inferSelect;
type TemplateRow = typeof recurringVisitTemplates.$inferSelect;
type VisitInstanceRow = typeof visitInstances.$inferSelect;
type VisitInstanceExceptionRow = typeof visitInstanceExceptions.$inferSelect;
type PatientVisitWindowRow = typeof patientVisitWindows.$inferSelect;

export type RecurringTemplateWithWindows = TemplateRow & {
  days: TemplateDayRow[];
  daysOfWeek: number[];
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

const uniqueSortedDays = (daysOfWeek: number[]) =>
  Array.from(new Set(daysOfWeek)).sort((left, right) => left - right);

const insertTemplateDays = async (
  transaction: ReturnType<typeof getDb>,
  templateId: string,
  daysOfWeek: number[],
) => {
  if (daysOfWeek.length === 0) {
    return [] as TemplateDayRow[];
  }

  return transaction
    .insert(recurringVisitTemplateDays)
    .values(daysOfWeek.map((dayOfWeek) => ({ templateId, dayOfWeek })))
    .returning();
};

const attachTemplateSchedule = async (
  templates: TemplateRow[],
): Promise<RecurringTemplateWithWindows[]> => {
  if (templates.length === 0) {
    return [];
  }

  const templateIds = templates.map((template) => template.id);
  const days = await getDb()
    .select()
    .from(recurringVisitTemplateDays)
    .where(inArray(recurringVisitTemplateDays.templateId, templateIds))
    .orderBy(asc(recurringVisitTemplateDays.dayOfWeek));

  const daysByTemplateId = new Map<string, TemplateDayRow[]>();
  days.forEach((day) => {
    const existing = daysByTemplateId.get(day.templateId) ?? [];
    existing.push(day);
    daysByTemplateId.set(day.templateId, existing);
  });

  return templates.map((template) => {
    const templateDays = daysByTemplateId.get(template.id) ?? [];

    return {
      ...template,
      days: templateDays,
      daysOfWeek: uniqueSortedDays(templateDays.map((day) => day.dayOfWeek)),
    };
  });
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

const parseOccurrenceKey = (occurrenceKey: string) => {
  const parts = occurrenceKey.split(":");
  if (parts.length !== 3) {
    return null;
  }

  const [templateId, windowId, planningDate] = parts;
  if (!templateId || !windowId || !planningDate) {
    return null;
  }

  return {
    templateId,
    windowId,
    planningDate,
  };
};

type ClientVisitWindow = Pick<
  PatientVisitWindowRow,
  "id" | "startTime" | "endTime" | "visitTimeType"
>;

type ClientSchedule = {
  address: string;
  googlePlaceId: string | null;
  serviceDurationMinutes: number;
  visitWindows: ClientVisitWindow[];
};

const listClientSchedulesByIds = async (nurseId: string, patientIds: string[]) => {
  if (patientIds.length === 0) {
    return new Map<string, ClientSchedule>();
  }

  const rows = await getDb()
    .select({
      id: patients.id,
      address: patients.address,
      googlePlaceId: patients.googlePlaceId,
      visitDurationMinutes: patients.visitDurationMinutes,
      preferredVisitStartTime: patients.preferredVisitStartTime,
      preferredVisitEndTime: patients.preferredVisitEndTime,
      visitTimeType: patients.visitTimeType,
    })
    .from(patients)
    .where(
      and(
        eq(patients.nurseId, nurseId),
        eq(patients.isActive, true),
        inArray(patients.id, patientIds),
      ),
    );

  const visitWindows = await getDb()
    .select()
    .from(patientVisitWindows)
    .where(inArray(patientVisitWindows.patientId, patientIds))
    .orderBy(
      asc(patientVisitWindows.patientId),
      asc(patientVisitWindows.startTime),
      asc(patientVisitWindows.endTime),
      asc(patientVisitWindows.createdAt),
    );

  const windowsByPatientId = new Map<string, ClientVisitWindow[]>();
  visitWindows.forEach((window) => {
    const existing = windowsByPatientId.get(window.patientId) ?? [];
    existing.push(window);
    windowsByPatientId.set(window.patientId, existing);
  });

  return new Map(
    rows.map((row) => {
      const windows = windowsByPatientId.get(row.id);
      const visitWindowsForPatient =
        windows && windows.length > 0
          ? windows
          : [
              {
                id: `${row.id}-legacy`,
                startTime: row.preferredVisitStartTime,
                endTime: row.preferredVisitEndTime,
                visitTimeType: row.visitTimeType,
              },
            ];

      return [
        row.id,
        {
          address: row.address,
          googlePlaceId: row.googlePlaceId,
          serviceDurationMinutes: row.visitDurationMinutes,
          visitWindows: visitWindowsForPatient,
        },
      ];
    }),
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

const listVisitInstanceExceptionsForRange = async (
  nurseId: string,
  startDate: string,
  endDate: string,
  templateIds?: string[],
): Promise<
  Array<
    VisitInstanceExceptionRow & {
      occurrenceKey: string;
      patientId: string;
      templateIdFromInstance: string | null;
      address: string;
      googlePlaceId: string | null;
      windowStart: string;
      windowEnd: string;
      visitTimeType: string;
      serviceDurationMinutes: number;
    }
  >
> => {
  const baseCondition = and(
    eq(visitInstanceExceptions.nurseId, nurseId),
    or(
      and(
        gte(visitInstanceExceptions.exceptionDate, startDate),
        lte(visitInstanceExceptions.exceptionDate, endDate),
      ),
      and(
        gte(visitInstanceExceptions.rescheduledDate, startDate),
        lte(visitInstanceExceptions.rescheduledDate, endDate),
      ),
    ),
  );

  const whereCondition =
    templateIds && templateIds.length > 0
      ? and(baseCondition, inArray(visitInstances.templateId, templateIds))
      : baseCondition;

  return getDb()
    .select({
      id: visitInstanceExceptions.id,
      nurseId: visitInstanceExceptions.nurseId,
      visitInstanceId: visitInstanceExceptions.visitInstanceId,
      templateId: visitInstanceExceptions.templateId,
      exceptionDate: visitInstanceExceptions.exceptionDate,
      action: visitInstanceExceptions.action,
      rescheduledDate: visitInstanceExceptions.rescheduledDate,
      overrideStartTime: visitInstanceExceptions.overrideStartTime,
      overrideEndTime: visitInstanceExceptions.overrideEndTime,
      overrideVisitTimeType: visitInstanceExceptions.overrideVisitTimeType,
      overrideServiceDurationMinutes: visitInstanceExceptions.overrideServiceDurationMinutes,
      notes: visitInstanceExceptions.notes,
      createdAt: visitInstanceExceptions.createdAt,
      updatedAt: visitInstanceExceptions.updatedAt,
      occurrenceKey: visitInstances.occurrenceKey,
      patientId: visitInstances.patientId,
      templateIdFromInstance: visitInstances.templateId,
      address: visitInstances.address,
      googlePlaceId: visitInstances.googlePlaceId,
      windowStart: visitInstances.windowStart,
      windowEnd: visitInstances.windowEnd,
      visitTimeType: visitInstances.visitTimeType,
      serviceDurationMinutes: visitInstances.serviceDurationMinutes,
    })
    .from(visitInstanceExceptions)
    .innerJoin(visitInstances, eq(visitInstanceExceptions.visitInstanceId, visitInstances.id))
    .where(whereCondition)
    .orderBy(asc(visitInstanceExceptions.exceptionDate), asc(visitInstanceExceptions.createdAt));
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

  return attachTemplateSchedule(templates);
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

  const [withSchedule] = await attachTemplateSchedule([template]);
  return withSchedule ?? null;
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
      })
      .returning();

    const daysOfWeek = uniqueSortedDays(payload.daysOfWeek);
    const days = await insertTemplateDays(transaction, template.id, daysOfWeek);

    return {
      ...template,
      days,
      daysOfWeek,
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

  const shouldCancelFutureGeneratedInstances =
    payload.endDate !== undefined &&
    nextEndDate !== null &&
    (existing.endDate === null || nextEndDate < existing.endDate);

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

    const shouldReplaceDays = payload.daysOfWeek !== undefined;
    const nextDaysOfWeek = shouldReplaceDays
      ? uniqueSortedDays(payload.daysOfWeek ?? [])
      : existing.daysOfWeek;
    const nextDays = shouldReplaceDays
      ? await (async () => {
          await transaction
            .delete(recurringVisitTemplateDays)
            .where(eq(recurringVisitTemplateDays.templateId, updatedTemplate.id));

          return insertTemplateDays(transaction, updatedTemplate.id, nextDaysOfWeek);
        })()
      : existing.days;

    if (shouldCancelFutureGeneratedInstances && nextEndDate) {
      await transaction
        .update(visitInstances)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(visitInstances.nurseId, nurseId),
            eq(visitInstances.templateId, templateId),
            eq(visitInstances.isManualOverride, false),
            eq(visitInstances.status, "scheduled"),
            gt(visitInstances.planningDate, nextEndDate),
          ),
        );
    }

    return {
      ...updatedTemplate,
      days: nextDays,
      daysOfWeek: nextDaysOfWeek,
    };
  });
};

export const deleteRecurringVisitTemplateForNurse = async (nurseId: string, templateId: string) => {
  return getDb().transaction(async (tx) => {
    await tx
      .delete(visitInstances)
      .where(and(eq(visitInstances.nurseId, nurseId), eq(visitInstances.templateId, templateId)));

    const [deleted] = await tx
      .delete(recurringVisitTemplates)
      .where(
        and(
          eq(recurringVisitTemplates.id, templateId),
          eq(recurringVisitTemplates.nurseId, nurseId),
        ),
      )
      .returning({ id: recurringVisitTemplates.id });

    return deleted ?? null;
  });
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

  const clientSchedules = await listClientSchedulesByIds(
    nurseId,
    Array.from(new Set(filteredTemplates.map((template) => template.patientId))),
  );

  const candidateInsertRows: (typeof visitInstances.$inferInsert)[] = [];
  const dateRange = enumerateDateRange(payload.startDate, payload.endDate);

  filteredTemplates.forEach((template) => {
    const clientSchedule = clientSchedules.get(template.patientId);
    if (!clientSchedule) {
      return;
    }

    const parsedRule = parseRecurrenceRule(template.recurrenceRule);
    const templateDaySet = new Set(template.daysOfWeek);

    dateRange.forEach((planningDate) => {
      if (!isDateEligibleForTemplate(template, planningDate, parsedRule)) {
        return;
      }

      const dayOfWeek = dayOfWeekForDate(planningDate);
      if (!templateDaySet.has(dayOfWeek)) {
        return;
      }

      clientSchedule.visitWindows.forEach((window) => {
        candidateInsertRows.push({
          nurseId,
          patientId: template.patientId,
          templateId: template.id,
          occurrenceKey: toOccurrenceKey(template.id, window.id, planningDate),
          planningDate,
          address: clientSchedule.address,
          googlePlaceId: clientSchedule.googlePlaceId,
          windowStart: window.startTime,
          windowEnd: window.endTime,
          visitTimeType: window.visitTimeType,
          serviceDurationMinutes: clientSchedule.serviceDurationMinutes,
          status: "scheduled",
          isManualOverride: false,
        });
      });
    });
  });

  // A client should only get one instance per visit window per day even if they
  // appear in multiple templates. Deduplicate by (patientId, windowStart, windowEnd, planningDate),
  // keeping the first candidate (earliest template in iteration order).
  const seenWindowKeys = new Set<string>();
  const deduplicatedCandidates = candidateInsertRows.filter((row) => {
    const windowKey = `${row.patientId}:${row.planningDate}:${row.windowStart}:${row.windowEnd}`;
    if (seenWindowKeys.has(windowKey)) {
      return false;
    }
    seenWindowKeys.add(windowKey);
    return true;
  });

  const filteredTemplateIds = Array.from(new Set(filteredTemplates.map((template) => template.id)));

  const candidateByOccurrenceKey = new Map(
    deduplicatedCandidates.map((candidate) => [candidate.occurrenceKey, candidate]),
  );

  const exceptionRows = await listVisitInstanceExceptionsForRange(
    nurseId,
    payload.startDate,
    payload.endDate,
    filteredTemplateIds,
  );
  exceptionRows.forEach((exception) => {
    if (exception.action === "skip") {
      candidateByOccurrenceKey.delete(exception.occurrenceKey);
      return;
    }

    if (exception.action !== "reschedule" && exception.action !== "edit") {
      return;
    }

    const nextPlanningDate = exception.rescheduledDate ?? exception.exceptionDate;
    if (nextPlanningDate < payload.startDate || nextPlanningDate > payload.endDate) {
      candidateByOccurrenceKey.delete(exception.occurrenceKey);
      return;
    }

    const baseCandidate = candidateByOccurrenceKey.get(exception.occurrenceKey);
    const parsedOccurrence = parseOccurrenceKey(exception.occurrenceKey);
    candidateByOccurrenceKey.set(exception.occurrenceKey, {
      nurseId,
      patientId: exception.patientId,
      templateId: parsedOccurrence?.templateId ?? exception.templateIdFromInstance,
      occurrenceKey: exception.occurrenceKey,
      planningDate: nextPlanningDate,
      address: baseCandidate?.address ?? exception.address,
      googlePlaceId: baseCandidate?.googlePlaceId ?? exception.googlePlaceId,
      windowStart:
        exception.overrideStartTime ?? baseCandidate?.windowStart ?? exception.windowStart,
      windowEnd: exception.overrideEndTime ?? baseCandidate?.windowEnd ?? exception.windowEnd,
      visitTimeType:
        exception.overrideVisitTimeType ?? baseCandidate?.visitTimeType ?? exception.visitTimeType,
      serviceDurationMinutes:
        exception.overrideServiceDurationMinutes ??
        baseCandidate?.serviceDurationMinutes ??
        exception.serviceDurationMinutes,
      status: "scheduled",
      isManualOverride: true,
    });
  });

  const finalCandidates = [...candidateByOccurrenceKey.values()];
  const existingRowsInRange = await listVisitInstanceRowsForRange(
    nurseId,
    payload.startDate,
    payload.endDate,
    filteredTemplateIds,
  );
  const existingAnyByOccurrenceKey = new Map(
    existingRowsInRange.map((instance) => [instance.occurrenceKey, instance]),
  );

  const insertRows = finalCandidates.filter((row) => !existingAnyByOccurrenceKey.has(row.occurrenceKey));

  if (insertRows.length > 0) {
    try {
      await getDb().insert(visitInstances).values(insertRows);
    } catch (error) {
      if (!isUniqueViolationError(error)) {
        throw error;
      }
    }
  }

  for (const [occurrenceKey, candidate] of candidateByOccurrenceKey.entries()) {
    const existing = existingAnyByOccurrenceKey.get(occurrenceKey);
    if (!existing) {
      continue;
    }

    if (!candidate.isManualOverride && (existing.isManualOverride || existing.status !== "scheduled")) {
      continue;
    }

    const shouldRefresh =
      existing.planningDate !== candidate.planningDate ||
      existing.address !== candidate.address ||
      existing.googlePlaceId !== candidate.googlePlaceId ||
      existing.windowStart !== candidate.windowStart ||
      existing.windowEnd !== candidate.windowEnd ||
      existing.visitTimeType !== candidate.visitTimeType ||
      existing.serviceDurationMinutes !== candidate.serviceDurationMinutes ||
      existing.status !== candidate.status ||
      existing.isManualOverride !== candidate.isManualOverride;

    if (!shouldRefresh) {
      continue;
    }

    await getDb()
      .update(visitInstances)
      .set({
        planningDate: candidate.planningDate,
        address: candidate.address,
        googlePlaceId: candidate.googlePlaceId,
        windowStart: candidate.windowStart,
        windowEnd: candidate.windowEnd,
        visitTimeType: candidate.visitTimeType,
        serviceDurationMinutes: candidate.serviceDurationMinutes,
        status: candidate.status,
        isManualOverride: candidate.isManualOverride,
        updatedAt: new Date(),
      })
      .where(and(eq(visitInstances.id, existing.id), eq(visitInstances.nurseId, nurseId)));
  }

  const candidateOccurrenceKeys = new Set(finalCandidates.map((row) => row.occurrenceKey));
  const staleGeneratedInstanceIds = existingRowsInRange
    .filter(
      (instance) =>
        instance.isManualOverride === false &&
        instance.status === "scheduled" &&
        instance.templateId !== null &&
        !candidateOccurrenceKeys.has(instance.occurrenceKey),
    )
    .map((instance) => instance.id);

  if (staleGeneratedInstanceIds.length > 0) {
    await getDb()
      .update(visitInstances)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(visitInstances.nurseId, nurseId),
          inArray(visitInstances.id, staleGeneratedInstanceIds),
        ),
      );
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

  if (!updated) {
    return null;
  }

  const parsedOccurrence = parseOccurrenceKey(existing.occurrenceKey);
  const exceptionDate = parsedOccurrence?.planningDate ?? existing.planningDate;
  const templateIdForException = existing.templateId ?? parsedOccurrence?.templateId ?? null;
  const hasRescheduleMutation =
    payload.planningDate !== undefined ||
    payload.windowStart !== undefined ||
    payload.windowEnd !== undefined ||
    payload.visitTimeType !== undefined ||
    payload.serviceDurationMinutes !== undefined;

  const shouldWriteSkipException = updated.status === "cancelled";
  const shouldWriteRescheduleException = updated.status === "scheduled" && hasRescheduleMutation;

  if (shouldWriteSkipException || shouldWriteRescheduleException || payload.status === "scheduled") {
    await getDb()
      .delete(visitInstanceExceptions)
      .where(eq(visitInstanceExceptions.visitInstanceId, updated.id));
  }

  if (shouldWriteSkipException) {
    await getDb().insert(visitInstanceExceptions).values({
      nurseId,
      visitInstanceId: updated.id,
      templateId: templateIdForException,
      exceptionDate,
      action: "skip",
    });
  } else if (shouldWriteRescheduleException) {
    await getDb().insert(visitInstanceExceptions).values({
      nurseId,
      visitInstanceId: updated.id,
      templateId: templateIdForException,
      exceptionDate,
      action: "reschedule",
      rescheduledDate: updated.planningDate,
      overrideStartTime: updated.windowStart,
      overrideEndTime: updated.windowEnd,
      overrideVisitTimeType: updated.visitTimeType,
      overrideServiceDurationMinutes: updated.serviceDurationMinutes,
    });
  }

  return updated;
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
