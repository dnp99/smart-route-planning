import type { AuthUser } from "../../../../shared/contracts";

const SESSION_SCOPED_KEYS = ["careflow.route-planner.draft.v1"];
const SESSION_STORAGE_SCOPED_KEYS = ["careflow_route_optimization_result"];
const PERSISTED_AUTH_USER_KEY = "careflow.auth-user.v1";
let authBootstrapInFlight = false;
let authBootstrapPromise: Promise<void> | null = null;
let resolveAuthBootstrap: (() => void) | null = null;

const AUTH_CHANGED_EVENT = "careflow-auth-changed";

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

export const beginAuthBootstrap = () => {
  if (authBootstrapInFlight) {
    return;
  }

  authBootstrapInFlight = true;
  authBootstrapPromise = new Promise<void>((resolve) => {
    resolveAuthBootstrap = resolve;
  });
};

export const completeAuthBootstrap = () => {
  if (!authBootstrapInFlight) {
    return;
  }

  authBootstrapInFlight = false;
  const resolve = resolveAuthBootstrap;
  authBootstrapPromise = null;
  resolveAuthBootstrap = null;
  resolve?.();
};

export const waitForAuthBootstrap = async () => {
  if (!authBootstrapPromise) {
    return;
  }
  await authBootstrapPromise;
};

const parseAuthUser = (value: unknown): AuthUser | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const parsed = value as Partial<AuthUser>;

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

const persistAuthUser = (user: AuthUser): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PERSISTED_AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // ignore quota errors
  }
};

const clearPersistedAuthUser = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PERSISTED_AUTH_USER_KEY);
};

// Initialize from localStorage so returning users don't hit a blocking fetchMe() gate
let currentAuthUser: AuthUser | null = (() => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PERSISTED_AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    return parseAuthUser(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
})();

export const getAuthToken = () => {
  return null;
};

export const getAuthUser = (): AuthUser | null => {
  return parseAuthUser(currentAuthUser);
};

export const setAuthSession = (user: AuthUser) => {
  if (typeof window === "undefined") {
    return;
  }

  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  currentAuthUser = user;
  persistAuthUser(user);
  emitAuthChanged();
};

export const setStoredAuthUser = (user: AuthUser) => {
  currentAuthUser = user;
  persistAuthUser(user);
  emitAuthChanged();
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  currentAuthUser = null;
  clearPersistedAuthUser();
  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  emitAuthChanged();
};
