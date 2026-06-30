import type { WeeklyWorkingHours } from "../../../../shared/contracts";

// A day's working-hours status. "off" and "unconfigured" are deliberately
// distinct: a disabled/absent day is only a real day off once the user has set
// up a weekly schedule. With no schedule at all, the day is unconfigured — we
// must never present that as "off".
export type DayWorkingStatus =
  | { status: "scheduled"; start: string; end: string }
  | { status: "off" }
  | { status: "unconfigured" };

// True once at least one day is enabled, i.e. the user has a real weekly
// schedule. The data model can't otherwise tell a deliberate day off apart from
// a never-configured one (both store enabled:false / absent), so this is the
// signal we use to disambiguate the two.
export const hasConfiguredSchedule = (workingHours?: WeeklyWorkingHours | null): boolean =>
  !!workingHours && Object.values(workingHours).some((day) => day?.enabled);

export const getDayWorkingStatus = (
  workingHours: WeeklyWorkingHours | null | undefined,
  dayKey: keyof WeeklyWorkingHours,
): DayWorkingStatus => {
  const day = workingHours?.[dayKey];
  if (day?.enabled) {
    return { status: "scheduled", start: day.start, end: day.end };
  }
  return hasConfiguredSchedule(workingHours) ? { status: "off" } : { status: "unconfigured" };
};
