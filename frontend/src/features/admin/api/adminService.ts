import { resolveApiBaseUrl } from "../../../components/shared/apiBaseUrl";

// Admin API client. Uses the isolated admin session cookie (separate from the
// nurse session) — credentials: "include" sends it. All calls hit /api/admin/*.

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
};

const readError = async (response: Response): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return "Something went wrong.";
};

const parseAdminUser = (value: unknown): AdminUser | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const admin = (value as { admin?: unknown }).admin;
  if (typeof admin !== "object" || admin === null) {
    return null;
  }
  const record = admin as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.displayName !== "string"
  ) {
    return null;
  }
  return { id: record.id, email: record.email, displayName: record.displayName };
};

export const adminLogin = async (email: string, password: string): Promise<AdminUser> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/admin/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const admin = parseAdminUser(await response.json().catch(() => null));
  if (!admin) {
    throw new Error("Unexpected login response.");
  }
  return admin;
};

export const fetchAdminMe = async (): Promise<AdminUser | null> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/admin/auth/me`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return parseAdminUser(await response.json().catch(() => null));
};

export const adminLogout = async (): Promise<void> => {
  await fetch(`${resolveApiBaseUrl()}/api/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
};
