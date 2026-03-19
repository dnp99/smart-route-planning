// Centralized break threshold for route timeline gaps.
// Later this can be replaced by a nurse-configured preference.
export const BREAK_GAP_THRESHOLD_MINUTES = 30;

export const expectedStartTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const formatExpectedStartTimeText = (serviceStartTime: string): string => {
  const parsedDate = new Date(serviceStartTime);
  const parsedTimeMs = parsedDate.getTime();
  if (parsedTimeMs !== parsedTimeMs) {
    return "";
  }

  return `Expected start time ${expectedStartTimeFormatter.format(parsedDate)}`;
};

export const formatBreakGap = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const formatVisitDurationMinutes = (minutes: number): string => {
  if (
    typeof minutes !== "number" ||
    minutes !== minutes ||
    minutes === Infinity ||
    minutes === -Infinity ||
    minutes <= 0
  ) {
    return "";
  }

  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const remainingMinutes = wholeMinutes % 60;

  if (hours === 0) {
    return `${wholeMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hr" : `${hours} hrs`;
  }

  const hourLabel = hours === 1 ? "1 hr" : `${hours} hrs`;
  return `${hourLabel} ${remainingMinutes} min`;
};

export const timeToMinutes = (value: string): number => {
  const [hoursString, minutesString] = value.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
};

const normalizeAddressForComparison = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export const addressesMatch = (leftAddress: string, rightAddress: string): boolean => {
  const normalizedLeft = normalizeAddressForComparison(leftAddress);
  const normalizedRight = normalizeAddressForComparison(rightAddress);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
};
