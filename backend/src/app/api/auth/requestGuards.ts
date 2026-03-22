import { HttpError } from "../../../lib/http";
import {
  __resetAuthLoginRateLimitForTests,
  enforceAuthLoginRateLimit,
} from "../../../lib/rateLimit/authLoginRateLimit";

export const resolveAuthClientKey = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "anonymous";
};

const requestUsesHttps = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
  if (forwardedProto) {
    const firstForwardedProto = forwardedProto.split(",")[0]?.trim();
    if (firstForwardedProto) {
      return firstForwardedProto === "https";
    }
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

export const requireSecureAuthTransport = (request: Request) => {
  const shouldEnforceHttps =
    process.env.AUTH_ENFORCE_HTTPS === "true" || process.env.NODE_ENV === "production";
  if (!shouldEnforceHttps) {
    return;
  }

  if (!requestUsesHttps(request)) {
    throw new HttpError(426, "HTTPS is required for authentication endpoints.");
  }
};

export const enforceLoginRateLimit = async (request: Request, email?: string) => {
  await enforceAuthLoginRateLimit({
    clientKey: resolveAuthClientKey(request),
    ...(email && email.trim().length > 0 ? { accountKey: email.trim().toLowerCase() } : {}),
  });
};

export const __resetLoginRateLimitForTests = () => {
  __resetAuthLoginRateLimitForTests();
};
