import type { AuthUser } from "../../../../shared/contracts";

const TOKEN_STORAGE_KEY = "careflow.auth.token";
const USER_STORAGE_KEY = "careflow.auth.user";

const AUTH_CHANGED_EVENT = "careflow-auth-changed";

const emitAuthChanged = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const getAuthChangedEventName = () => AUTH_CHANGED_EVENT;

export const getAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const getAuthUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.displayName !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const setAuthSession = (token: string, user: AuthUser) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  emitAuthChanged();
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  emitAuthChanged();
};
