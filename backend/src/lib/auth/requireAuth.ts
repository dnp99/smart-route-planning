import { HttpError } from "../http";
import { findNurseById } from "../patients/patientRepository";
import { verifyAccessToken } from "./jwt";
import { readSessionIdFromCookieHeader } from "./sessionCookie";
import { findValidSessionWithNurse } from "./sessionRepository";

export type AuthContext = {
  nurseId: string;
  email: string;
  authMethod: "session_cookie" | "bearer_token";
  sessionId?: string;
};

const readBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    throw new HttpError(401, "Missing or invalid authorization token.");
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    throw new HttpError(401, "Missing or invalid authorization token.");
  }

  return token;
};

export const requireAuth = async (request: Request): Promise<AuthContext> => {
  const sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));

  if (sessionId) {
    const row = await findValidSessionWithNurse(sessionId);
    if (row) {
      if (!row.isActive) {
        throw new HttpError(401, "Unauthorized.");
      }

      return {
        nurseId: row.nurseId,
        email: row.email,
        authMethod: "session_cookie",
        sessionId,
      };
    }
  }

  const token = readBearerToken(request);
  const verified = await verifyAccessToken(token);
  const nurse = await findNurseById(verified.sub);

  if (!nurse || !nurse.isActive) {
    throw new HttpError(401, "Unauthorized.");
  }

  return {
    nurseId: nurse.id,
    email: nurse.email,
    authMethod: "bearer_token",
  };
};
