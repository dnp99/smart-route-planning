const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type DaySchedule = {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
  lunchBreak?: {
    enabled: boolean;
    startTime: string; // HH:mm
    durationMinutes: number;
  };
};

export type WeeklyWorkingHours = {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
};

export type SetupMissingField =
  | "displayName"
  | "homeAddress"
  | "workingHours"
  | "optimizationObjective";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  homeAddress: string | null;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
  optimizationObjective?: "time" | "distance" | null;
  isSetupComplete?: boolean;
  setupMissing?: SetupMissingField[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type SignupRequest = {
  displayName: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  user: AuthUser;
};

export type SignupResponse = {
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser;
};

export type UpdateMeRequest = {
  displayName?: string;
  homeAddress?: string;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
  optimizationObjective?: "time" | "distance" | null;
};

export const isAuthUser = (value: unknown): value is AuthUser => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    typeof value.displayName !== "string" ||
    (typeof value.homeAddress !== "string" && value.homeAddress !== null)
  ) {
    return false;
  }

  if (
    value.breakGapThresholdMinutes !== undefined &&
    value.breakGapThresholdMinutes !== null &&
    typeof value.breakGapThresholdMinutes !== "number"
  ) {
    return false;
  }

  if (
    value.optimizationObjective !== undefined &&
    value.optimizationObjective !== null &&
    value.optimizationObjective !== "time" &&
    value.optimizationObjective !== "distance"
  ) {
    return false;
  }

  if (value.isSetupComplete !== undefined && typeof value.isSetupComplete !== "boolean") {
    return false;
  }

  if (
    value.setupMissing !== undefined &&
    (!Array.isArray(value.setupMissing) ||
      !value.setupMissing.every(
        (entry) =>
          entry === "displayName" ||
          entry === "homeAddress" ||
          entry === "workingHours" ||
          entry === "optimizationObjective",
      ))
  ) {
    return false;
  }

  return true;
};

const hasAtLeastOneEnabledWorkingDay = (
  workingHours: WeeklyWorkingHours | null | undefined,
): boolean => {
  if (!workingHours || typeof workingHours !== "object") {
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

  return dayKeys.some((dayKey) => {
    const day = workingHours[dayKey];
    return Boolean(day?.enabled);
  });
};

export const resolveSetupMissingFields = (user: {
  displayName?: string | null;
  homeAddress?: string | null;
  workingHours?: WeeklyWorkingHours | null;
  optimizationObjective?: "time" | "distance" | null | string;
}): SetupMissingField[] => {
  const missing: SetupMissingField[] = [];

  if (typeof user.displayName !== "string" || user.displayName.trim().length === 0) {
    missing.push("displayName");
  }

  if (typeof user.homeAddress !== "string" || user.homeAddress.trim().length === 0) {
    missing.push("homeAddress");
  }

  if (!hasAtLeastOneEnabledWorkingDay(user.workingHours ?? null)) {
    missing.push("workingHours");
  }

  if (user.optimizationObjective !== "time" && user.optimizationObjective !== "distance") {
    missing.push("optimizationObjective");
  }

  return missing;
};

export const resolveIsSetupComplete = (user: {
  displayName?: string | null;
  homeAddress?: string | null;
  workingHours?: WeeklyWorkingHours | null;
  optimizationObjective?: "time" | "distance" | null | string;
}) => resolveSetupMissingFields(user).length === 0;

export const isLoginRequest = (value: unknown): value is LoginRequest => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.email === "string" && typeof value.password === "string";
};

export const isSignupRequest = (value: unknown): value is SignupRequest => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.displayName === "string" &&
    typeof value.email === "string" &&
    typeof value.password === "string"
  );
};

export const isUpdateMeRequest = (value: unknown): value is UpdateMeRequest => {
  if (!isObject(value)) {
    return false;
  }

  const hasDisplayName = value.displayName !== undefined;
  const hasHomeAddress = value.homeAddress !== undefined;
  const hasWorkingHours = value.workingHours !== undefined;
  const hasBreakGap = value.breakGapThresholdMinutes !== undefined;
  const hasOptimizationObjective = value.optimizationObjective !== undefined;

  if (!hasDisplayName && !hasHomeAddress && !hasWorkingHours && !hasBreakGap && !hasOptimizationObjective) {
    return false;
  }

  if (hasDisplayName && typeof value.displayName !== "string") {
    return false;
  }

  if (hasHomeAddress && typeof value.homeAddress !== "string") {
    return false;
  }

  if (
    hasBreakGap &&
    value.breakGapThresholdMinutes !== null &&
    typeof value.breakGapThresholdMinutes !== "number"
  ) {
    return false;
  }

  if (
    hasOptimizationObjective &&
    value.optimizationObjective !== null &&
    value.optimizationObjective !== "time" &&
    value.optimizationObjective !== "distance"
  ) {
    return false;
  }

  return true;
};

export type UpdatePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export const isUpdatePasswordRequest = (value: unknown): value is UpdatePasswordRequest => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.currentPassword === "string" && typeof value.newPassword === "string";
};

export const parseLoginResponse = (value: unknown): LoginResponse | null => {
  if (!isObject(value)) {
    return null;
  }

  if (!isAuthUser(value.user)) {
    return null;
  }

  return {
    user: value.user,
  };
};

export const parseMeResponse = (value: unknown): MeResponse | null => {
  if (!isObject(value) || !isAuthUser(value.user)) {
    return null;
  }

  return {
    user: value.user,
  };
};
