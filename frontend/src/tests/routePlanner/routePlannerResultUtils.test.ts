import { describe, expect, it } from "vitest";
import {
  addressesMatch,
  createRouteTimeFormatter,
  formatBreakGap,
  formatExpectedStartTimeText,
  formatVisitDurationMinutes,
  getZonedMinutesOfDay,
  resolveZoneUtcOffset,
  timeToMinutes,
} from "../../features/route-planner/utils/routePlannerResultUtils";

describe("routePlannerResultUtils", () => {
  it("returns empty expected start text for invalid timestamps", () => {
    const formatter = createRouteTimeFormatter("America/Toronto");
    expect(formatExpectedStartTimeText("not-a-date", formatter)).toBe("");
  });

  it("formats route times in the route timezone, not the device timezone", () => {
    // 12:14 UTC is 08:14 in Toronto (EDT, UTC-4). The formatter must render in
    // the route zone regardless of where the device running the test sits.
    const formatter = createRouteTimeFormatter("America/Toronto");
    const label = formatExpectedStartTimeText("2026-06-30T12:14:00Z", formatter);
    expect(label).toBe("Expected start time 08:14 AM");
  });

  it("reads minutes-of-day in the route timezone, not the device timezone", () => {
    // 12:14 UTC → 08:14 in Toronto (EDT) = 494 min; 23:30 in Tokyo (next day in
    // UTC) stays same-day in zone.
    expect(getZonedMinutesOfDay(new Date("2026-06-30T12:14:00Z"), "America/Toronto")).toBe(
      8 * 60 + 14,
    );
    expect(getZonedMinutesOfDay(new Date("2026-06-30T12:14:00Z"), "Asia/Tokyo")).toBe(21 * 60 + 14);
  });

  it("resolves a zone's UTC offset as a ±HH:MM string", () => {
    // Toronto observes EDT (UTC-4) on this summer date.
    expect(resolveZoneUtcOffset(Date.parse("2026-06-30T12:00:00Z"), "America/Toronto")).toBe(
      "-04:00",
    );
    // …and EST (UTC-5) in winter.
    expect(resolveZoneUtcOffset(Date.parse("2026-01-15T12:00:00Z"), "America/Toronto")).toBe(
      "-05:00",
    );
    expect(resolveZoneUtcOffset(Date.parse("2026-06-30T12:00:00Z"), "Asia/Kolkata")).toBe("+05:30");
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
