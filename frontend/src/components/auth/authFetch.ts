import { extractApiErrorMessage } from "../../../../shared/contracts";
import { resolveApiBaseUrl } from "../apiBaseUrl";
import { clearAuthSession, waitForAuthBootstrap } from "./authSession";

export const requestAuthedJson = async (
  path: string,
  init: RequestInit,
  fallbackMessage: string,
) => {
  await waitForAuthBootstrap();

  const headers = new Headers(init.headers);

  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
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
