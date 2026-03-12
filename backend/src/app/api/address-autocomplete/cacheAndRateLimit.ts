import { HttpError } from "../../../lib/http";
import type { AddressSuggestion } from "../../../../../shared/contracts";
import { CACHE_TTL_MS, RATE_LIMIT_WINDOW_MS } from "./constants";

const queryCache = new Map<string, { suggestions: AddressSuggestion[]; expiresAt: number }>();
const lastRequestAtByClient = new Map<string, number>();

const normalizeQueryKey = (query: string) => query.trim().toLowerCase();

export const getCachedSuggestions = (query: string) => {
  const now = Date.now();
  const cacheKey = normalizeQueryKey(query);
  const cached = queryCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    queryCache.delete(cacheKey);
    return null;
  }

  return cached.suggestions;
};

export const setCachedSuggestions = (query: string, suggestions: AddressSuggestion[]) => {
  const cacheKey = normalizeQueryKey(query);
  queryCache.set(cacheKey, {
    suggestions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

export const resolveClientKey = (request: Request) => {
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

export const enforceRateLimit = (clientKey: string) => {
  const now = Date.now();
  const lastRequestAt = lastRequestAtByClient.get(clientKey) ?? 0;

  if (now - lastRequestAt < RATE_LIMIT_WINDOW_MS) {
    throw new HttpError(429, "Please wait before requesting more address suggestions.");
  }

  lastRequestAtByClient.set(clientKey, now);
};
