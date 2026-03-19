import { describe, expect, it } from "vitest";
import {
  addressesMatch,
  formatBreakGap,
  formatExpectedStartTimeText,
  formatVisitDurationMinutes,
  timeToMinutes,
} from "../../components/routePlanner/routePlannerResultUtils";

describe("routePlannerResultUtils", () => {
  it("returns empty expected start text for invalid timestamps", () => {
    expect(formatExpectedStartTimeText("not-a-date")).toBe("");
  });

  it("formats break gaps across minutes, exact hours, and mixed durations", () => {
    expect(formatBreakGap(45)).toBe("45m");
    expect(formatBreakGap(120)).toBe("2h");
    expect(formatBreakGap(95)).toBe("1h 35m");
  });

  it("formats visit durations and rejects non-positive or non-finite values", () => {
    expect(formatVisitDurationMinutes(0)).toBe("");
    expect(formatVisitDurationMinutes(Number.NaN)).toBe("");
    expect(formatVisitDurationMinutes(Infinity)).toBe("");
    expect(formatVisitDurationMinutes(30)).toBe("30 min");
    expect(formatVisitDurationMinutes(60)).toBe("1 hr");
    expect(formatVisitDurationMinutes(120)).toBe("2 hrs");
    expect(formatVisitDurationMinutes(95)).toBe("1 hr 35 min");
  });

  it("converts times to minutes and compares normalized addresses", () => {
    expect(timeToMinutes("07:45")).toBe(465);
    expect(addressesMatch(" 1 Main   Street ", "1 main street")).toBe(true);
    expect(addressesMatch("", "1 main street")).toBe(false);
    expect(addressesMatch("1 Main Street", "2 Main Street")).toBe(false);
  });
});
