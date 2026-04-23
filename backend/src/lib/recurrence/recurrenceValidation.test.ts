import { describe, expect, it } from "vitest";
import { HttpError } from "../http";
import {
  validateCreateRecurringVisitTemplatePayload,
  validateExpandVisitInstancesPayload,
  validateUpdateRecurringVisitTemplatePayload,
  validateUpdateVisitInstancePayload,
  validateVisitInstancesPlanningDate,
} from "./recurrenceValidation";

const validCreatePayload = {
  patientId: "client-1",
  name: " Monday morning ",
  timezone: "America/Toronto",
  recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
  startDate: "2026-05-04",
  endDate: "2026-06-01",
  daysOfWeek: [1],
};

const expectBadRequest = (operation: () => unknown, message: string) => {
  expect(operation).toThrow(HttpError);
  expect(operation).toThrow(message);
};

describe("recurrenceValidation", () => {
  describe("validateCreateRecurringVisitTemplatePayload", () => {
    it("normalizes a valid create payload", () => {
      expect(validateCreateRecurringVisitTemplatePayload(validCreatePayload)).toEqual({
        patientId: "client-1",
        name: "Monday morning",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        startDate: "2026-05-04",
        endDate: "2026-06-01",
        daysOfWeek: [1],
      });
    });

    it("defaults optional create fields", () => {
      expect(
        validateCreateRecurringVisitTemplatePayload({
          ...validCreatePayload,
          name: " ",
          endDate: null,
          daysOfWeek: [3, 1, 3],
        }),
      ).toEqual(
        expect.objectContaining({
          name: null,
          endDate: null,
          daysOfWeek: [1, 3],
        }),
      );
    });

    it("rejects malformed create payloads", () => {
      const cases: Array<[unknown, string]> = [
        [null, "Request body must be a JSON object."],
        [{ ...validCreatePayload, patientId: "" }, "patientId is required."],
        [{ ...validCreatePayload, name: 123 }, "name must be a string when provided."],
        [{ ...validCreatePayload, timezone: "Toronto" }, "timezone must be a valid IANA timezone."],
        [
          { ...validCreatePayload, startDate: "2026-02-30" },
          "startDate must be a valid calendar date.",
        ],
        [
          { ...validCreatePayload, endDate: "2026-05-01", startDate: "2026-05-02" },
          "endDate must be on or after startDate.",
        ],
        [{ ...validCreatePayload, daysOfWeek: [] }, "daysOfWeek must include at least one weekday."],
        [
          { ...validCreatePayload, daysOfWeek: [8] },
          "daysOfWeek[0] must be an integer from 0 (Sunday) to 6 (Saturday).",
        ],
      ];

      cases.forEach(([payload, message]) => {
        expectBadRequest(() => validateCreateRecurringVisitTemplatePayload(payload), message);
      });
    });
  });

  describe("validateUpdateRecurringVisitTemplatePayload", () => {
    it("normalizes all supported update fields", () => {
      expect(
        validateUpdateRecurringVisitTemplatePayload({
          patientId: "client-2",
          name: null,
          timezone: "America/New_York",
          recurrenceRule: "FREQ=DAILY;INTERVAL=2",
          startDate: "2026-05-05",
          endDate: null,
          daysOfWeek: [2, 1, 2],
          isActive: false,
        }),
      ).toEqual({
        patientId: "client-2",
        name: null,
        timezone: "America/New_York",
        recurrenceRule: "FREQ=DAILY;INTERVAL=2",
        startDate: "2026-05-05",
        endDate: null,
        daysOfWeek: [1, 2],
        isActive: false,
      });
    });

    it("rejects invalid update combinations", () => {
      const cases: Array<[unknown, string]> = [
        [false, "Request body must be a JSON object."],
        [{ isActive: "yes" }, "isActive must be a boolean when provided."],
        [
          { startDate: "2026-05-10", endDate: "2026-05-09" },
          "endDate must be on or after startDate.",
        ],
        [{ endDate: "05/10/2026" }, "endDate must use YYYY-MM-DD format."],
        [{ daysOfWeek: [] }, "daysOfWeek must include at least one weekday."],
        [{ daysOfWeek: [8] }, "daysOfWeek[0] must be an integer from 0 (Sunday) to 6 (Saturday)."],
      ];

      cases.forEach(([payload, message]) => {
        expectBadRequest(() => validateUpdateRecurringVisitTemplatePayload(payload), message);
      });
    });
  });

  describe("validateExpandVisitInstancesPayload", () => {
    it("accepts planningDate shorthand and date ranges", () => {
      expect(validateExpandVisitInstancesPayload({ planningDate: "2026-05-04" })).toEqual({
        startDate: "2026-05-04",
        endDate: "2026-05-04",
      });
      expect(
        validateExpandVisitInstancesPayload({
          startDate: "2026-05-04",
          endDate: "2026-05-06",
          templateIds: [" tpl-1 ", "tpl-2"],
        }),
      ).toEqual({
        startDate: "2026-05-04",
        endDate: "2026-05-06",
        templateIds: ["tpl-1", "tpl-2"],
      });
    });

    it("rejects invalid expand payloads", () => {
      const cases: Array<[unknown, string]> = [
        [undefined, "Request body must be a JSON object."],
        [{}, "Either planningDate or startDate must be provided."],
        [
          { startDate: "2026-05-06", endDate: "2026-05-04" },
          "endDate must be on or after startDate.",
        ],
        [{ planningDate: "2026-13-01" }, "planningDate must be a valid calendar date."],
        [
          { planningDate: "2026-05-04", templateIds: "tpl-1" },
          "templateIds must be an array when provided.",
        ],
        [{ planningDate: "2026-05-04", templateIds: [""] }, "templateIds[0] is required."],
      ];

      cases.forEach(([payload, message]) => {
        expectBadRequest(() => validateExpandVisitInstancesPayload(payload), message);
      });
    });
  });

  describe("validateVisitInstancesPlanningDate", () => {
    it("requires and parses the planning date query parameter", () => {
      expect(validateVisitInstancesPlanningDate("2026-05-04")).toBe("2026-05-04");
      expectBadRequest(
        () => validateVisitInstancesPlanningDate(null),
        "planningDate query parameter is required.",
      );
    });
  });

  describe("validateUpdateVisitInstancePayload", () => {
    it("normalizes all supported instance update fields", () => {
      expect(
        validateUpdateVisitInstancePayload({
          status: "cancelled",
          planningDate: "2026-05-04",
          address: " 123 Main St ",
          googlePlaceId: " ",
          windowStart: "09:00",
          windowEnd: "10:00",
          visitTimeType: "flexible",
          serviceDurationMinutes: 15,
        }),
      ).toEqual({
        status: "cancelled",
        planningDate: "2026-05-04",
        address: "123 Main St",
        googlePlaceId: null,
        windowStart: "09:00",
        windowEnd: "10:00",
        visitTimeType: "flexible",
        serviceDurationMinutes: 15,
      });
    });

    it("rejects invalid instance updates", () => {
      const cases: Array<[unknown, string]> = [
        ["bad", "Request body must be a JSON object."],
        [{}, "At least one updatable field is required."],
        [{ status: "done" }, "status must be one of: scheduled, cancelled."],
        [{ address: "" }, "address is required."],
        [{ googlePlaceId: 123 }, "googlePlaceId must be a string when provided."],
        [{ windowStart: "10:00", windowEnd: "09:59" }, "windowEnd must be later than windowStart."],
      ];

      cases.forEach(([payload, message]) => {
        expectBadRequest(() => validateUpdateVisitInstancePayload(payload), message);
      });
    });
  });
});
