import { extractApiErrorMessage } from "../../../../shared/contracts";
import { resolveApiBaseUrl } from "../apiBaseUrl";
import { clearAuthSession, getAuthToken } from "./authSession";

export const requestAuthedJson = async (
  path: string,
  init: RequestInit,
  fallbackMessage: string,
) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Please login to continue.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    clearAuthSession();
    throw new Error(extractApiErrorMessage(payload) ?? "Session expired. Please login again.");
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? fallbackMessage);
  }

  return payload;
};
