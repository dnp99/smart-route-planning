import { HttpError } from "../http";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const TOO_MANY_ATTEMPTS_MESSAGE = "Too many password update attempts. Please try again later.";

type RateLimitEntry = {
  windowStart: number;
  count: number;
  lockUntilMs: number;
};

const updatePasswordRateLimitByBucket = new Map<string, RateLimitEntry>();

const enforceBucket = (bucketKey: string) => {
  const nowMs = Date.now();
  const current = updatePasswordRateLimitByBucket.get(bucketKey);

  if (current && current.lockUntilMs > nowMs) {
    const retryAfterSeconds = Math.ceil((current.lockUntilMs - nowMs) / 1000);
    throw new HttpError(429, TOO_MANY_ATTEMPTS_MESSAGE, {
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    });
  }

  if (!current || nowMs - current.windowStart >= WINDOW_MS) {
    updatePasswordRateLimitByBucket.set(bucketKey, {
      windowStart: nowMs,
      count: 1,
      lockUntilMs: 0,
    });
    return;
  }

  if (current.count >= MAX_REQUESTS) {
    const lockUntilMs = nowMs + LOCKOUT_SECONDS * 1000;
    updatePasswordRateLimitByBucket.set(bucketKey, { ...current, lockUntilMs });
    throw new HttpError(429, TOO_MANY_ATTEMPTS_MESSAGE, {
      headers: { "Retry-After": String(LOCKOUT_SECONDS) },
    });
  }

  updatePasswordRateLimitByBucket.set(bucketKey, { ...current, count: current.count + 1 });
};

type EnforceUpdatePasswordRateLimitParams = {
  nurseId: string;
  clientKey: string;
};

export const enforceUpdatePasswordRateLimit = ({
  nurseId,
  clientKey,
}: EnforceUpdatePasswordRateLimitParams) => {
  enforceBucket(`auth:update-password:nurse:${nurseId}`);
  enforceBucket(`auth:update-password:client:${clientKey}`);
};

export const __resetUpdatePasswordRateLimitForTests = () => {
  updatePasswordRateLimitByBucket.clear();
};
