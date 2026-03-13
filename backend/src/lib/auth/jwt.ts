import { SignJWT, jwtVerify } from "jose";
import { HttpError } from "../http";

type AccessTokenPayload = {
  sub: string;
  email: string;
};

const resolveJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new HttpError(500, "Server is missing JWT_SECRET configuration.");
  }

  return new TextEncoder().encode(jwtSecret);
};

const resolveJwtExpiry = () => {
  const configured = process.env.JWT_EXPIRES_IN?.trim();
  return configured || "1h";
};

export const signAccessToken = async ({ nurseId, email }: { nurseId: string; email: string }) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(nurseId)
    .setIssuedAt()
    .setExpirationTime(resolveJwtExpiry())
    .sign(resolveJwtSecret());

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload> => {
  try {
    const { payload } = await jwtVerify(token, resolveJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      throw new HttpError(401, "Missing or invalid authorization token.");
    }

    return {
      sub: payload.sub,
      email: payload.email,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Missing or invalid authorization token.");
  }
};
