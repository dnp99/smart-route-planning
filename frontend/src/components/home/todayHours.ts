import type { WeeklyWorkingHours } from "../../../../shared/contracts";
import { getDayWorkingStatus } from "./workingHoursStatus";

// Today's working-hours display label. "Off today" is reserved for a real day
// off (the user has a schedule but this day is disabled); an unconfigured
// schedule shows "Not set" so we don't imply the user chose to be off.
export const resolveTodayHoursDisplay = (workingHours?: WeeklyWorkingHours | null) => {
  const dayKey = new Date()
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase() as keyof WeeklyWorkingHours;
  const status = getDayWorkingStatus(workingHours, dayKey);

  if (status.status === "scheduled") {
    return `${status.start} - ${status.end}`;
  }
  return status.status === "off" ? "Off today" : "Not set";
};
