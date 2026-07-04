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

export type AdminNurseSummary = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  activePatientCount: number;
};

export type AdminMetrics = {
  nurses: { total: number; active: number };
  signups: { total: number; last7Days: number; last30Days: number };
  activeNurses: { dau: number; wau: number };
  clientsAdded: { last7Days: number; last30Days: number };
  signupTrend: { date: string; count: number }[];
};

const getJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
};

export const fetchAdminNurses = async (): Promise<AdminNurseSummary[]> => {
  const payload = (await getJson("/api/admin/nurses")) as { nurses?: unknown };
  return Array.isArray(payload.nurses) ? (payload.nurses as AdminNurseSummary[]) : [];
};

export const fetchAdminMetrics = async (): Promise<AdminMetrics> => {
  const payload = (await getJson("/api/admin/metrics")) as { metrics?: AdminMetrics };
  return payload.metrics as AdminMetrics;
};

export type AdminNurseProfile = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  homeAddress: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminNursePatient = {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
};

export type AdminActivityEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminNurseDetail = {
  nurse: AdminNurseProfile;
  patients: AdminNursePatient[];
  activity: AdminActivityEvent[];
};

export const fetchAdminNurseDetail = async (nurseId: string): Promise<AdminNurseDetail> => {
  const payload = (await getJson(`/api/admin/nurses/${encodeURIComponent(nurseId)}`)) as {
    nurse?: AdminNurseProfile;
    patients?: AdminNursePatient[];
    activity?: AdminActivityEvent[];
  };
  return {
    nurse: payload.nurse as AdminNurseProfile,
    patients: Array.isArray(payload.patients) ? payload.patients : [],
    activity: Array.isArray(payload.activity) ? payload.activity : [],
  };
};

const postAdmin = async (path: string): Promise<unknown> => {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json().catch(() => ({}));
};

export const deactivateNurse = (nurseId: string): Promise<unknown> =>
  postAdmin(`/api/admin/nurses/${encodeURIComponent(nurseId)}/deactivate`);

export const reactivateNurse = (nurseId: string): Promise<unknown> =>
  postAdmin(`/api/admin/nurses/${encodeURIComponent(nurseId)}/reactivate`);

export const resetNursePassword = async (nurseId: string): Promise<string> => {
  const payload = (await postAdmin(
    `/api/admin/nurses/${encodeURIComponent(nurseId)}/reset-password`,
  )) as { temporaryPassword?: unknown };
  if (typeof payload.temporaryPassword !== "string") {
    throw new Error("Unexpected reset response.");
  }
  return payload.temporaryPassword;
};
