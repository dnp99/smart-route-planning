import type { AuthUser } from "../../../../shared/contracts";

const SESSION_SCOPED_KEYS = ["careflow.route-planner.draft.v1"];
const SESSION_STORAGE_SCOPED_KEYS = ["careflow_route_optimization_result"];
const SESSION_PRESENCE_KEY = "careflow.session-presence.v1";
let authBootstrapInFlight = false;
let authBootstrapPromise: Promise<void> | null = null;
let resolveAuthBootstrap: (() => void) | null = null;
let authBootstrapStartedAtMs: number | null = null;

const AUTH_CHANGED_EVENT = "careflow-auth-changed";
const AUTH_BOOTSTRAP_EVENT = "careflow-auth-bootstrap";

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
export const getAuthBootstrapEventName = () => AUTH_BOOTSTRAP_EVENT;

const emitAuthBootstrapEvent = (
  phase: "started" | "completed" | "failed" | "timed_out",
  metadata?: Record<string, unknown>,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_BOOTSTRAP_EVENT, {
      detail: {
        phase,
        ...(metadata ?? {}),
      },
    }),
  );
};

export const beginAuthBootstrap = () => {
  if (authBootstrapInFlight) {
    return;
  }

  authBootstrapInFlight = true;
  authBootstrapStartedAtMs = Date.now();
  emitAuthBootstrapEvent("started", {
    hasCachedUser: currentAuthUser !== null,
  });
  authBootstrapPromise = new Promise<void>((resolve) => {
    resolveAuthBootstrap = resolve;
  });
};

export const completeAuthBootstrap = () => {
  if (!authBootstrapInFlight) {
    return;
  }

  const durationMs =
    authBootstrapStartedAtMs === null ? null : Math.max(0, Date.now() - authBootstrapStartedAtMs);
  authBootstrapInFlight = false;
  authBootstrapStartedAtMs = null;
  const resolve = resolveAuthBootstrap;
  authBootstrapPromise = null;
  resolveAuthBootstrap = null;
  emitAuthBootstrapEvent("completed", { durationMs });
  resolve?.();
};

export const recordAuthBootstrapFailure = (error: unknown) => {
  const durationMs =
    authBootstrapStartedAtMs === null ? null : Math.max(0, Date.now() - authBootstrapStartedAtMs);
  emitAuthBootstrapEvent("failed", {
    durationMs,
    message: error instanceof Error ? error.message : "Unknown auth bootstrap error.",
  });
};

export const recordAuthBootstrapTimeout = (timeoutMs: number) => {
  const durationMs =
    authBootstrapStartedAtMs === null ? null : Math.max(0, Date.now() - authBootstrapStartedAtMs);
  emitAuthBootstrapEvent("timed_out", {
    durationMs,
    timeoutMs,
  });
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
        parsed.optimizationObjective !== "distance") ||
      (parsed.isSetupComplete !== undefined && typeof parsed.isSetupComplete !== "boolean") ||
      (parsed.setupMissing !== undefined &&
        (!Array.isArray(parsed.setupMissing) ||
          !parsed.setupMissing.every(
            (entry) =>
              entry === "displayName" ||
              entry === "workingHours" ||
              entry === "optimizationObjective",
          )))
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
      isSetupComplete: parsed.isSetupComplete ?? false,
      setupMissing: parsed.setupMissing ?? [],
    };
  } catch {
    return null;
  }
};

let currentAuthUser: AuthUser | null = null;

export const getSessionPresenceFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SESSION_PRESENCE_KEY) === "1";
};

const setSessionPresenceFlag = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_PRESENCE_KEY, "1");
  } catch {
    // ignore quota errors
  }
};

const clearSessionPresenceFlag = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_PRESENCE_KEY);
};

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
  setSessionPresenceFlag();
  emitAuthChanged();
};

export const setStoredAuthUser = (user: AuthUser) => {
  currentAuthUser = user;
  setSessionPresenceFlag();
  emitAuthChanged();
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  currentAuthUser = null;
  clearSessionPresenceFlag();
  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  emitAuthChanged();
};
