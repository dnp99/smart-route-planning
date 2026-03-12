import { HttpError } from "../http";
import { findNurseById } from "../patients/patientRepository";
import { verifyAccessToken } from "./jwt";

export type AuthContext = {
  nurseId: string;
  email: string;
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
  const token = readBearerToken(request);
  const verified = await verifyAccessToken(token);
  const nurse = await findNurseById(verified.sub);

  if (!nurse || !nurse.isActive) {
    throw new HttpError(401, "Unauthorized.");
  }

  return {
    nurseId: nurse.id,
    email: nurse.email,
  };
};
