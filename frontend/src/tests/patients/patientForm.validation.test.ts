import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIT_DURATION_MINUTES,
  validateForm,
  type PatientFormValues,
} from "../../features/patients/domain/patientForm";

const buildValues = (overrides?: Partial<PatientFormValues>): PatientFormValues => ({
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: null,
  visitDurationMinutes: DEFAULT_VISIT_DURATION_MINUTES,
  visitWindows: [
    {
      id: "window-1",
      startTime: "09:00",
      endTime: "10:00",
      visitTimeType: "fixed",
    },
  ],
  recurringTemplates: [],
  ...overrides,
});

describe("patientForm validateForm", () => {
  it("allows overlapping visit windows", () => {
    const errors = validateForm(
      buildValues({
        visitWindows: [
          {
            id: "window-1",
            startTime: "09:00",
            endTime: "10:00",
            visitTimeType: "fixed",
          },
          {
            id: "window-2",
            startTime: "09:30",
            endTime: "10:30",
            visitTimeType: "flexible",
          },
        ],
      }),
    );

    expect(errors.visitWindows).toBeUndefined();
    expect(errors.visitWindowRows).toBeUndefined();
  });

  it("still rejects windows where end time is not later than start time", () => {
    const errors = validateForm(
      buildValues({
        visitWindows: [
          {
            id: "window-1",
            startTime: "10:30",
            endTime: "10:00",
            visitTimeType: "fixed",
          },
        ],
      }),
    );

    expect(errors.visitWindowRows?.[0]?.endTime).toBe(
      "End time must be later than start time (cross-midnight windows are not supported).",
    );
  });

  it("rejects fixed windows shorter than the configured visit duration", () => {
    const errors = validateForm(
      buildValues({
        visitDurationMinutes: 45,
        visitWindows: [
          {
            id: "window-1",
            startTime: "09:00",
            endTime: "09:30",
            visitTimeType: "fixed",
          },
        ],
      }),
    );

    expect(errors.visitWindowRows?.[0]?.endTime).toBe(
      "Jane Doe fixed window must be at least 45 minutes long as per client's profile.",
    );
  });

  it("allows short flexible windows when duration is longer", () => {
    const errors = validateForm(
      buildValues({
        visitDurationMinutes: 45,
        visitWindows: [
          {
            id: "window-1",
            startTime: "09:00",
            endTime: "09:30",
            visitTimeType: "flexible",
          },
        ],
      }),
    );

    expect(errors.visitWindowRows).toBeUndefined();
  });

  it("validates recurring template date and timezone fields", () => {
    const errors = validateForm(
      buildValues({
        recurringTemplates: [
          {
            id: "draft-1",
            templateId: null,
            name: "Weekdays",
            timezone: "Mars/Phobos",
            recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
            startDate: "2026-03-20",
            endDate: "2026-03-19",
            endFromDate: "",
            isActive: true,
            daysOfWeek: [1],
          },
        ],
      }),
    );

    expect(errors.recurringTemplateRows?.[0]?.timezone).toBe(
      "Timezone must be a valid IANA timezone.",
    );
    expect(errors.recurringTemplateRows?.[0]?.endDate).toBe(
      "End date must be on or after start date.",
    );
  });

  it("requires at least one weekday on recurring template", () => {
    const errors = validateForm(
      buildValues({
        recurringTemplates: [
          {
            id: "draft-1",
            templateId: null,
            name: "Empty days",
            timezone: "America/Toronto",
            recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
            startDate: "2026-03-20",
            endDate: "",
            endFromDate: "",
            isActive: true,
            daysOfWeek: [],
          },
        ],
      }),
    );

    expect(errors.recurringTemplateRows?.[0]?.daysOfWeek).toBe("Select at least one weekday.");
  });

  it("requires end-from date to be after template start date", () => {
    const errors = validateForm(
      buildValues({
        recurringTemplates: [
          {
            id: "draft-1",
            templateId: "template-1",
            name: "Weekdays",
            timezone: "America/Toronto",
            recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
            startDate: "2026-03-20",
            endDate: "",
            endFromDate: "2026-03-20",
            isActive: true,
            daysOfWeek: [1],
          },
        ],
      }),
    );

    expect(errors.recurringTemplateRows?.[0]?.endDate).toBe(
      "End-from date must be after start date.",
    );
  });
});
