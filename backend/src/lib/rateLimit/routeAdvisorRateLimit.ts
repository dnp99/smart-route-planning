import { HttpError } from "../http";

// Best-effort, in-memory per-nurse limiter for the Route Advisor. Unlike the
// login limiter this is not a security control — it just protects the Anthropic
// bill from a stuck client. A single-process sliding window is plenty; it fails
// open (never blocks) if the process restarts, and never hard-fails the request.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const hits = new Map<string, number[]>();

export const enforceRouteAdvisorRateLimit = (nurseId: string, now: number = Date.now()): void => {
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(nurseId) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    throw new HttpError(429, "Too many advice requests. Please wait a moment.", {
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

  recent.push(now);
  hits.set(nurseId, recent);
};

// Test-only helper to reset the window between cases.
export const __resetRouteAdvisorRateLimit = (): void => {
  hits.clear();
};
