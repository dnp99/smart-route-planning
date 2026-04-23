import { describe, expect, it } from "vitest";
import { toRecurringVisitTemplateDto, toVisitInstanceDto } from "./recurrenceDto";
import type { RecurringTemplateWithWindows } from "./recurrenceRepository";

describe("recurrenceDto", () => {
  it("maps recurring templates and trims SQL time strings", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const template = {
      id: "tpl-1",
      nurseId: "nurse-1",
      patientId: "client-1",
      name: null,
      timezone: "America/Toronto",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startDate: "2026-05-04",
      endDate: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      days: [
        {
          id: "day-1",
          templateId: "tpl-1",
          dayOfWeek: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      daysOfWeek: [1],
    } as RecurringTemplateWithWindows;

    expect(toRecurringVisitTemplateDto(template)).toEqual({
      id: "tpl-1",
      nurseId: "nurse-1",
      patientId: "client-1",
      name: null,
      timezone: "America/Toronto",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startDate: "2026-05-04",
      endDate: null,
      isActive: true,
      daysOfWeek: [1],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it("maps visit instances and falls back to fixed/scheduled for unknown row values", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");

    expect(
      toVisitInstanceDto({
        id: "inst-1",
        nurseId: "nurse-1",
        patientId: "client-1",
        templateId: "tpl-1",
        occurrenceKey: "tpl-1:window-1:2026-05-04",
        planningDate: "2026-05-04",
        address: "123 Main St",
        googlePlaceId: null,
        windowStart: "09:00:00",
        windowEnd: "10:00:00",
        visitTimeType: "other",
        serviceDurationMinutes: 30,
        status: "other",
        isManualOverride: false,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual(
      expect.objectContaining({
        windowStart: "09:00",
        windowEnd: "10:00",
        visitTimeType: "fixed",
        status: "scheduled",
      }),
    );

    expect(
      toVisitInstanceDto({
        id: "inst-2",
        nurseId: "nurse-1",
        patientId: "client-1",
        templateId: null,
        occurrenceKey: "manual",
        planningDate: "2026-05-04",
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "11:00:00",
        windowEnd: "12:00:00",
        visitTimeType: "flexible",
        serviceDurationMinutes: 30,
        status: "cancelled",
        isManualOverride: true,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual(
      expect.objectContaining({
        templateId: null,
        googlePlaceId: "place-1",
        visitTimeType: "flexible",
        status: "cancelled",
        isManualOverride: true,
      }),
    );
  });
});
