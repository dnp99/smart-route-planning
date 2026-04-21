import {
  extractApiErrorMessage,
  parseLoginResponse,
  parseMeResponse,
  type LoginResponse,
  type SignupResponse,
  type WeeklyWorkingHours,
} from "../../../../shared/contracts";
import { resolveApiBaseUrl } from "../shared/apiBaseUrl";

export type LegalNoticeStatus = {
  required: boolean;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
};

const parseLegalNoticeStatus = (value: unknown): LegalNoticeStatus | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (
    typeof payload.required !== "boolean" ||
    typeof payload.currentVersion !== "string" ||
    (payload.acceptedVersion !== null && typeof payload.acceptedVersion !== "string") ||
    (payload.acceptedAt !== null && typeof payload.acceptedAt !== "string")
  ) {
    return null;
  }

  return {
    required: payload.required,
    currentVersion: payload.currentVersion,
    acceptedVersion: payload.acceptedVersion,
    acceptedAt: payload.acceptedAt,
  };
};

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

export const fetchLegalNoticeStatus = async (): Promise<LegalNoticeStatus> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/legal-notice`, {
    method: "GET",
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? "Unable to load legal notice status.");
  }

  const parsed = parseLegalNoticeStatus(payload);
  if (!parsed) {
    throw new Error("Unexpected legal-notice response format.");
  }

  return parsed;
};

export const acknowledgeLegalNotice = async (): Promise<LegalNoticeStatus> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/legal-notice`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ agree: true }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      extractApiErrorMessage(payload) ?? "Unable to save legal notice acknowledgement.",
    );
  }

  const parsed = parseLegalNoticeStatus(payload);
  if (!parsed) {
    throw new Error("Unexpected legal-notice acknowledgement response format.");
  }

  return parsed;
};
