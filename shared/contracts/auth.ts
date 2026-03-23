const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type DaySchedule = {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
  lunchBreak?: {
    enabled: boolean;
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

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  homeAddress: string | null;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
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
  token: string;
  user: AuthUser;
};

export type SignupResponse = LoginResponse;

export type MeResponse = {
  user: AuthUser;
};

export type UpdateMeRequest = {
  homeAddress?: string;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
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

  return true;
};

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

  const hasHomeAddress = value.homeAddress !== undefined;
  const hasWorkingHours = value.workingHours !== undefined;
  const hasBreakGap = value.breakGapThresholdMinutes !== undefined;

  if (!hasHomeAddress && !hasWorkingHours && !hasBreakGap) {
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

  if (typeof value.token !== "string" || !isAuthUser(value.user)) {
    return null;
  }

  return {
    token: value.token,
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
