import { HttpError } from "../../../lib/http";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

type RateLimitEntry = {
  windowStart: number;
  count: number;
};

const rateLimitByClient = new Map<string, RateLimitEntry>();

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
    const firstIp = forwardedFor.split(",")[0].trim();
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

export const requireOptimizeRouteApiKey = (request: Request) => {
  const configuredApiKey = process.env.OPTIMIZE_ROUTE_API_KEY?.trim();
  if (!configuredApiKey) {
    return;
  }

  const providedApiKey = request.headers.get("x-optimize-route-key")?.trim();
  if (!providedApiKey || providedApiKey !== configuredApiKey) {
    throw new HttpError(401, "Missing or invalid optimize-route API key.");
  }
};

export const enforceOptimizeRouteRateLimit = (request: Request) => {
  const rateLimitWindowMs = parsePositiveInteger(
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  const maxRequests = parsePositiveInteger(
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_MAX_REQUESTS,
  );

  const clientKey = resolveClientKey(request);
  const now = Date.now();
  const current = rateLimitByClient.get(clientKey);

  if (!current || now - current.windowStart >= rateLimitWindowMs) {
    rateLimitByClient.set(clientKey, { windowStart: now, count: 1 });
    return;
  }

  if (current.count >= maxRequests) {
    throw new HttpError(429, "Too many optimize route requests. Please try again shortly.");
  }

  current.count += 1;
  rateLimitByClient.set(clientKey, current);
};

export const __resetOptimizeRouteRateLimitForTests = () => {
  rateLimitByClient.clear();
};
