import type { WeeklyWorkingHours } from "../../../../shared/contracts";

// Today's working-hours display label (e.g. "08:00 - 15:00", "Off today", "—").
export const resolveTodayHoursDisplay = (workingHours?: WeeklyWorkingHours | null) => {
  if (!workingHours) {
    return "—";
  }

  const dayKey = new Date()
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase() as keyof WeeklyWorkingHours;
  const daySchedule = workingHours[dayKey];

  if (!daySchedule?.enabled) {
    return "Off today";
  }

  return `${daySchedule.start} - ${daySchedule.end}`;
};
