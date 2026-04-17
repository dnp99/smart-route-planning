import {
  extractApiErrorMessage,
  parseLoginResponse,
  parseMeResponse,
  type LoginResponse,
  type SignupResponse,
  type WeeklyWorkingHours,
} from "../../../../shared/contracts";
import { resolveApiBaseUrl } from "../apiBaseUrl";

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to login.");
  }

  const parsed = parseLoginResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected login response format.");
  }

  return parsed;
};

export const signUp = async (
  displayName: string,
  email: string,
  password: string,
): Promise<SignupResponse> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/signup`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName, email, password }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to sign up.");
  }

  const parsed = parseLoginResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected signup response format.");
  }

  return parsed;
};

export const fetchMe = async () => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to load current user.");
  }

  const parsed = parseMeResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected current-user response format.");
  }

  return parsed;
};

export const updateProfile = async (updates: { displayName?: string; homeAddress?: string }) => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to update profile.");
  }

  const parsed = parseMeResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected profile-update response format.");
  }

  return parsed;
};

export const updateProfileHomeAddress = async (homeAddress: string) => {
  return updateProfile({ homeAddress });
};

export const updateWorkingHours = async (
  workingHours: WeeklyWorkingHours | null,
  breakGapThresholdMinutes: number | null,
) => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workingHours, breakGapThresholdMinutes }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to update working hours.");
  }

  const parsed = parseMeResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected working-hours update response format.");
  }

  return parsed;
};

export const updateOptimizationObjective = async (
  optimizationObjective: "time" | "distance" | null,
) => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ optimizationObjective }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to update optimization objective.");
  }

  const parsed = parseMeResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected optimization-objective update response format.");
  }

  return parsed;
};

export const updatePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/update-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to update password.");
  }
};

export const logout = async (): Promise<void> => {
  const apiBaseUrl = resolveApiBaseUrl();
  await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
};
