import type { AuthUser } from "../../../../shared/contracts";

const SESSION_SCOPED_KEYS = ["careflow.route-planner.draft.v1", "careflow.headerQuote"];
const SESSION_STORAGE_SCOPED_KEYS = ["careflow_route_optimization_result"];

const AUTH_CHANGED_EVENT = "careflow-auth-changed";
let currentAuthUser: AuthUser | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLunchBreak = (value: unknown) => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === "boolean" &&
    typeof value.startTime === "string" &&
    typeof value.durationMinutes === "number"
  );
};

const isDaySchedule = (value: unknown) => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.enabled !== "boolean" ||
    typeof value.start !== "string" ||
    typeof value.end !== "string"
  ) {
    return false;
  }

  if (value.lunchBreak === undefined) {
    return true;
  }

  return isLunchBreak(value.lunchBreak);
};

const isWeeklyWorkingHours = (value: unknown) => {
  if (!isRecord(value)) {
    return false;
  }

  const dayKeys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;

  return dayKeys.every((dayKey) => {
    const daySchedule = value[dayKey];
    return daySchedule === undefined || isDaySchedule(daySchedule);
  });
};

const emitAuthChanged = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const getAuthChangedEventName = () => AUTH_CHANGED_EVENT;

export const getAuthToken = () => {
  return null;
};

export const getAuthUser = (): AuthUser | null => {
  const parsed = currentAuthUser as Partial<AuthUser> | null;
  if (!parsed) {
    return null;
  }

  try {
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.displayName !== "string" ||
      (parsed.homeAddress !== undefined &&
        parsed.homeAddress !== null &&
        typeof parsed.homeAddress !== "string") ||
      (parsed.workingHours !== undefined &&
        parsed.workingHours !== null &&
        !isWeeklyWorkingHours(parsed.workingHours)) ||
      (parsed.breakGapThresholdMinutes !== undefined &&
        parsed.breakGapThresholdMinutes !== null &&
        typeof parsed.breakGapThresholdMinutes !== "number") ||
      (parsed.optimizationObjective !== undefined &&
        parsed.optimizationObjective !== null &&
        parsed.optimizationObjective !== "time" &&
        parsed.optimizationObjective !== "distance")
    ) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email,
      displayName: parsed.displayName,
      homeAddress: parsed.homeAddress ?? null,
      workingHours: parsed.workingHours ?? null,
      breakGapThresholdMinutes: parsed.breakGapThresholdMinutes ?? null,
      optimizationObjective: parsed.optimizationObjective ?? null,
    };
  } catch {
    return null;
  }
};

export const setAuthSession = (user: AuthUser) => {
  if (typeof window === "undefined") {
    return;
  }

  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  currentAuthUser = user;
  emitAuthChanged();
};

export const setStoredAuthUser = (user: AuthUser) => {
  currentAuthUser = user;
  emitAuthChanged();
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  currentAuthUser = null;
  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  emitAuthChanged();
};
