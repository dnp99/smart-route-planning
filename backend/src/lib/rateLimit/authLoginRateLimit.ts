import { HttpError } from "../http";

const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LOGIN_MAX_REQUESTS = 5;
const DEFAULT_LOGIN_LOCKOUT_SECONDS = 30;
const TOO_MANY_ATTEMPTS_MESSAGE = "Too many login attempts. Please try again shortly.";

type RateLimitEntry = {
  windowStart: number;
  count: number;
  lockUntilMs: number;
};

type UpstashConfig = {
  url: string;
  token: string;
};

const loginRateLimitByBucket = new Map<string, RateLimitEntry>();

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

const resolveRateLimitConfig = () => ({
  windowMs: parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  ),
  maxRequests: parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_LOGIN_MAX_REQUESTS,
  ),
  lockoutSeconds: parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS,
    DEFAULT_LOGIN_LOCKOUT_SECONDS,
  ),
});

const resolveUpstashConfig = (): UpstashConfig | null => {
  const url = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
};

const parsePipelineResults = (payload: unknown): unknown[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Upstash pipeline response is invalid.");
  }

  return payload.map((entry) => {
    if (typeof entry === "object" && entry !== null && "result" in entry) {
      return (entry as { result: unknown }).result;
    }

    return entry;
  });
};

const executeUpstashPipeline = async (
  upstash: UpstashConfig,
  commands: string[][],
): Promise<unknown[]> => {
  const response = await fetch(`${upstash.url}/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${upstash.token}`,
    },
    body: JSON.stringify(commands),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Upstash pipeline request failed with status ${response.status}.`);
  }

  return parsePipelineResults(payload);
};

const toInteger = (value: unknown): number | null => {
  if (typeof value === "number" && isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }

  return null;
};

const createRateLimitError = (retryAfterSeconds: number) =>
  new HttpError(429, TOO_MANY_ATTEMPTS_MESSAGE, {
    headers: { "Retry-After": String(Math.max(1, Math.floor(retryAfterSeconds))) },
  });

const enforceBucketMemory = (
  bucketKey: string,
  config: ReturnType<typeof resolveRateLimitConfig>,
) => {
  const nowMs = Date.now();
  const current = loginRateLimitByBucket.get(bucketKey);

  if (current && current.lockUntilMs > nowMs) {
    const retryAfterSeconds = Math.ceil((current.lockUntilMs - nowMs) / 1000);
    throw createRateLimitError(retryAfterSeconds);
  }

  if (!current || nowMs - current.windowStart >= config.windowMs) {
    loginRateLimitByBucket.set(bucketKey, {
      windowStart: nowMs,
      count: 1,
      lockUntilMs: 0,
    });
    return;
  }

  if (current.count >= config.maxRequests) {
    const lockUntilMs = nowMs + config.lockoutSeconds * 1000;
    loginRateLimitByBucket.set(bucketKey, {
      ...current,
      lockUntilMs,
    });
    throw createRateLimitError(config.lockoutSeconds);
  }

  loginRateLimitByBucket.set(bucketKey, {
    ...current,
    count: current.count + 1,
  });
};

const enforceBucketUpstash = async (
  bucketKey: string,
  config: ReturnType<typeof resolveRateLimitConfig>,
  upstash: UpstashConfig,
) => {
  const lockKey = `${bucketKey}:lock`;
  const [lockTtlRaw] = await executeUpstashPipeline(upstash, [["TTL", lockKey]]);
  const lockTtlSeconds = toInteger(lockTtlRaw) ?? -1;
  if (lockTtlSeconds > 0) {
    throw createRateLimitError(lockTtlSeconds);
  }

  const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000));
  const [countRaw, ttlRaw] = await executeUpstashPipeline(upstash, [
    ["INCR", bucketKey],
    ["TTL", bucketKey],
  ]);

  const count = toInteger(countRaw);
  if (count === null) {
    throw new Error("Upstash rate-limit counter response is invalid.");
  }

  const ttlSeconds = toInteger(ttlRaw) ?? -1;
  if (ttlSeconds < 0) {
    await executeUpstashPipeline(upstash, [["EXPIRE", bucketKey, String(windowSeconds)]]);
  }

  if (count > config.maxRequests) {
    await executeUpstashPipeline(upstash, [
      ["SET", lockKey, "1", "EX", String(config.lockoutSeconds), "NX"],
    ]);
    throw createRateLimitError(config.lockoutSeconds);
  }
};

const sanitizeBucketValue = (value: string) => value.trim().toLowerCase();

const buildBucketKey = (kind: "client" | "account", rawValue: string) =>
  `auth:login:${kind}:${sanitizeBucketValue(rawValue)}`;

type EnforceLoginRateLimitParams = {
  clientKey: string;
  accountKey?: string;
};

export const enforceAuthLoginRateLimit = async ({
  clientKey,
  accountKey,
}: EnforceLoginRateLimitParams) => {
  const config = resolveRateLimitConfig();
  const upstash = resolveUpstashConfig();
  const bucketKeys = [
    buildBucketKey("client", clientKey),
    ...(accountKey ? [buildBucketKey("account", accountKey)] : []),
  ];

  for (const bucketKey of bucketKeys) {
    if (!upstash) {
      enforceBucketMemory(bucketKey, config);
      continue;
    }

    try {
      await enforceBucketUpstash(bucketKey, config, upstash);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Fall back to process-local limiter if centralized limiter is unavailable.
      enforceBucketMemory(bucketKey, config);
    }
  }
};

export const __resetAuthLoginRateLimitForTests = () => {
  loginRateLimitByBucket.clear();
};
