import { describe, expect, it } from "vitest";
import type { RecurringVisitTemplate } from "../../../../shared/contracts";
import { getPatientInitials } from "../../features/patients/domain/patientName";
import { countActiveRecurringTemplates } from "../../features/patients/domain/recurringTemplate";

describe("getPatientInitials", () => {
  it("uses first letters of first and last name", () => {
    expect(getPatientInitials("Jane", "Doe")).toBe("JD");
    expect(getPatientInitials("  yasmin ", "ramji")).toBe("YR");
  });

  it("falls back to the first two letters when only one name exists", () => {
    expect(getPatientInitials("Jane", "")).toBe("JA");
    expect(getPatientInitials("", "Doe")).toBe("DO");
  });

  it("returns ? when there is no name", () => {
    expect(getPatientInitials("", "")).toBe("?");
  });
});

describe("countActiveRecurringTemplates", () => {
  const template = (isActive: boolean): RecurringVisitTemplate =>
    ({ id: `t-${isActive}`, isActive }) as RecurringVisitTemplate;

  it("counts only active templates", () => {
    expect(countActiveRecurringTemplates([template(true), template(false), template(true)])).toBe(
      2,
    );
  });

  it("returns 0 for empty or undefined", () => {
    expect(countActiveRecurringTemplates([])).toBe(0);
    expect(countActiveRecurringTemplates(undefined)).toBe(0);
  });
});
