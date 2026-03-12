import {
  extractApiErrorMessage,
  parseLoginResponse,
  parseMeResponse,
  type LoginResponse,
} from "../../../../shared/contracts";
import { resolveApiBaseUrl } from "../apiBaseUrl";

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
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

export const fetchMe = async (token: string) => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
