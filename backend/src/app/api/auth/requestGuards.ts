import { HttpError } from "../../../lib/http";

const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LOGIN_MAX_REQUESTS = 5;

type RateLimitEntry = {
  windowStart: number;
  count: number;
};

const loginRateLimitByClient = new Map<string, RateLimitEntry>();

const parsePositiveInteger = (rawValue: string | undefined, fallback: number) => {
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.floor(parsedValue);
};

const resolveClientKey = (request: Request) => {
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

export const enforceLoginRateLimit = (request: Request) => {
  const rateLimitWindowMs = parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  );
  const maxRequests = parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_LOGIN_MAX_REQUESTS,
  );

  const clientKey = resolveClientKey(request);
  const now = Date.now();
  const current = loginRateLimitByClient.get(clientKey);

  if (!current || now - current.windowStart >= rateLimitWindowMs) {
    loginRateLimitByClient.set(clientKey, { windowStart: now, count: 1 });
    return;
  }

  if (current.count >= maxRequests) {
    throw new HttpError(429, "Too many login attempts. Please try again shortly.");
  }

  current.count += 1;
  loginRateLimitByClient.set(clientKey, current);
};

export const __resetLoginRateLimitForTests = () => {
  loginRateLimitByClient.clear();
};
