import { HttpError } from "../http";
import { readSessionIdFromCookieHeader } from "./sessionCookie";
import { findValidSessionWithNurse } from "./sessionRepository";

export type AuthContext = {
  nurseId: string;
  email: string;
  sessionId: string;
};

export const requireAuth = async (request: Request): Promise<AuthContext> => {
  const sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));

  if (!sessionId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const row = await findValidSessionWithNurse(sessionId);
  if (!row || !row.isActive) {
    throw new HttpError(401, "Unauthorized.");
  }

  return {
    nurseId: row.nurseId,
    email: row.email,
    sessionId,
  };
};
