import { HttpError } from "../http";
import { readAdminSessionIdFromCookieHeader } from "./adminSessionCookie";
import { findValidAdminSessionWithAdmin } from "./adminSessionRepository";

export type AdminContext = {
  adminId: string;
  email: string;
  displayName: string;
  sessionId: string;
};

// Guard for every /api/admin/* route. Only an admin session cookie can satisfy
// it — a nurse session cookie has a different name and never resolves here.
export const requireAdmin = async (request: Request): Promise<AdminContext> => {
  const sessionId = readAdminSessionIdFromCookieHeader(request.headers.get("cookie"));

  if (!sessionId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const row = await findValidAdminSessionWithAdmin(sessionId);
  if (!row || !row.isActive) {
    throw new HttpError(401, "Unauthorized.");
  }

  return {
    adminId: row.adminId,
    email: row.email,
    displayName: row.displayName,
    sessionId,
  };
};
