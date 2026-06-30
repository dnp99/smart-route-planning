import { describe, expect, it } from "vitest";
import {
  getDayWorkingStatus,
  hasConfiguredSchedule,
} from "../../components/home/workingHoursStatus";

const enabledDay = { enabled: true, start: "08:00", end: "16:00" };
const disabledDay = { enabled: false, start: "09:00", end: "17:00" };

describe("workingHoursStatus", () => {
  it("reports a scheduled day with its hours", () => {
    expect(getDayWorkingStatus({ friday: enabledDay }, "friday")).toEqual({
      status: "scheduled",
      start: "08:00",
      end: "16:00",
    });
  });

  it("treats a disabled day as 'off' only when the schedule is configured", () => {
    // Another day is enabled → the user has a real schedule, so Friday is a day off.
    expect(getDayWorkingStatus({ monday: enabledDay, friday: disabledDay }, "friday")).toEqual({
      status: "off",
    });
    // An absent day with a configured schedule is also a day off.
    expect(getDayWorkingStatus({ monday: enabledDay }, "friday")).toEqual({ status: "off" });
  });

  it("treats a disabled/absent day as 'unconfigured' when nothing is enabled", () => {
    expect(getDayWorkingStatus(null, "friday")).toEqual({ status: "unconfigured" });
    expect(getDayWorkingStatus({}, "friday")).toEqual({ status: "unconfigured" });
    expect(getDayWorkingStatus({ friday: disabledDay }, "friday")).toEqual({
      status: "unconfigured",
    });
  });

  it("hasConfiguredSchedule is true only when at least one day is enabled", () => {
    expect(hasConfiguredSchedule(null)).toBe(false);
    expect(hasConfiguredSchedule({})).toBe(false);
    expect(hasConfiguredSchedule({ friday: disabledDay })).toBe(false);
    expect(hasConfiguredSchedule({ friday: enabledDay })).toBe(true);
  });
});
