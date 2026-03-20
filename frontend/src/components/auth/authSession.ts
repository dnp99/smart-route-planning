import type { AuthUser } from "../../../../shared/contracts";

const TOKEN_STORAGE_KEY = "careflow.auth.token";
const USER_STORAGE_KEY = "careflow.auth.user";
const SESSION_SCOPED_KEYS = ["careflow.route-planner.draft.v1", "careflow.headerQuote"];
const SESSION_STORAGE_SCOPED_KEYS = ["careflow_route_optimization_result"];

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
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.displayName !== "string" ||
      (parsed.homeAddress !== undefined &&
        parsed.homeAddress !== null &&
        typeof parsed.homeAddress !== "string")
    ) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email,
      displayName: parsed.displayName,
      homeAddress: parsed.homeAddress ?? null,
    };
  } catch {
    return null;
  }
};

export const setAuthSession = (token: string, user: AuthUser) => {
  if (typeof window === "undefined") {
    return;
  }

  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  emitAuthChanged();
};

export const setStoredAuthUser = (user: AuthUser) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  SESSION_SCOPED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  SESSION_STORAGE_SCOPED_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  emitAuthChanged();
};
