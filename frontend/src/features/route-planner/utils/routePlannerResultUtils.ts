// Centralized break threshold for route timeline gaps.
// Later this can be replaced by a nurse-configured preference.
export const BREAK_GAP_THRESHOLD_MINUTES = 30;

// Builds the route time formatter for a specific route. `timeZone` MUST be the
// route's IANA zone (from the optimize response) — times are UTC instants, so
// without an explicit zone Intl formats in the device's zone and shows the wrong
// wall-clock whenever the device differs from the route. Falls back to the
// device zone only when the zone is unknown (legacy responses).
export const createRouteTimeFormatter = (timeZone?: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  });

// Minutes-of-day (0..1439) for an instant, evaluated in the route's `timeZone`.
// Schedule times are UTC instants; comparing them to working-hours / lunch
// "HH:mm" values requires reading the wall-clock in the ROUTE zone, not the
// device's. Falls back to the device zone when the zone is unknown (legacy
// responses) — matching the prior Date.getHours() behavior.
export const getZonedMinutesOfDay = (date: Date, timeZone?: string): number => {
  const ms = date.getTime();
  if (ms !== ms) {
    return 0;
  }
  if (!timeZone) {
    return date.getHours() * 60 + date.getMinutes();
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") {
      hours = Number(part.value);
    } else if (part.type === "minute") {
      minutes = Number(part.value);
    }
  }
  return hours * 60 + minutes;
};

// UTC offset of `timeZone` at `timestampMs`, as a "±HH:MM" string. Used to
// reconstruct window-start instants during manual reorder without depending on
// the device zone (the response times are emitted in UTC, so their ISO strings
// carry no usable offset).
export const resolveZoneUtcOffset = (timestampMs: number, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const fields: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      fields[part.type] = Number(part.value);
    }
  }
  const asUtcMs = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  );
  const offsetMinutes = Math.round((asUtcMs - timestampMs) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
};

export const formatExpectedStartTimeText = (
  serviceStartTime: string,
  formatter: Intl.DateTimeFormat,
  approximate = false,
): string => {
  const parsedDate = new Date(serviceStartTime);
  const parsedTimeMs = parsedDate.getTime();
  if (parsedTimeMs !== parsedTimeMs) {
    return "";
  }

  return `Expected start time ${approximate ? "~ " : ""}${formatter.format(parsedDate)}`;
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
