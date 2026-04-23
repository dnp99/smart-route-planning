import type {
  RecurringVisitTemplate as RecurringVisitTemplateContract,
  VisitInstance as VisitInstanceContract,
  VisitTimeType,
} from "../../../../shared/contracts";
import type { RecurringTemplateWithWindows } from "./recurrenceRepository";

type VisitInstanceRow = {
  id: string;
  nurseId: string;
  patientId: string;
  templateId: string | null;
  occurrenceKey: string;
  planningDate: string;
  address: string;
  googlePlaceId: string | null;
  windowStart: string;
  windowEnd: string;
  visitTimeType: string;
  serviceDurationMinutes: number;
  status: string;
  isManualOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toHourMinute = (value: string) => value.slice(0, 5);

const toVisitTimeType = (value: string): VisitTimeType =>
  value === "flexible" ? "flexible" : "fixed";

export const toRecurringVisitTemplateDto = (
  template: RecurringTemplateWithWindows,
): RecurringVisitTemplateContract => ({
  id: template.id,
  nurseId: template.nurseId,
  patientId: template.patientId,
  name: template.name,
  timezone: template.timezone,
  recurrenceRule: template.recurrenceRule,
  startDate: template.startDate,
  endDate: template.endDate,
  isActive: template.isActive,
  windows: [],
  daysOfWeek: template.daysOfWeek,
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString(),
});

export const toVisitInstanceDto = (instance: VisitInstanceRow): VisitInstanceContract => ({
  id: instance.id,
  nurseId: instance.nurseId,
  patientId: instance.patientId,
  templateId: instance.templateId,
  occurrenceKey: instance.occurrenceKey,
  planningDate: instance.planningDate,
  address: instance.address,
  googlePlaceId: instance.googlePlaceId,
  windowStart: toHourMinute(instance.windowStart),
  windowEnd: toHourMinute(instance.windowEnd),
  visitTimeType: toVisitTimeType(instance.visitTimeType),
  serviceDurationMinutes: instance.serviceDurationMinutes,
  status: instance.status === "cancelled" ? "cancelled" : "scheduled",
  isManualOverride: instance.isManualOverride,
  createdAt: instance.createdAt.toISOString(),
  updatedAt: instance.updatedAt.toISOString(),
});
