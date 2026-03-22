import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAuthLoginRateLimitForTests, enforceAuthLoginRateLimit } from "./authLoginRateLimit";

describe("authLoginRateLimit", () => {
  const fetchMock = vi.fn();
  const originalWindow = process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const originalMax = process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
  const originalLockout = process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS;
  const originalUpstashUrl = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;

  const buildUpstashResponse = (payload: unknown, ok = true, status = 200) =>
    ({
      ok,
      status,
      json: async () => payload,
    }) as Response;

  beforeEach(() => {
    __resetAuthLoginRateLimitForTests();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "5";
    delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
    delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    __resetAuthLoginRateLimitForTests();
    vi.unstubAllGlobals();

    if (originalWindow === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = originalWindow;
    }

    if (originalMax === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = originalMax;
    }

    if (originalLockout === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = originalLockout;
    }

    if (originalUpstashUrl === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    }

    if (originalUpstashToken === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
    }
  });

  it("applies lockout with retry-after headers in memory mode", async () => {
    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.1" })).resolves.toBeUndefined();

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.1" })).rejects.toMatchObject({
      status: 429,
      headers: { "Retry-After": "5" },
    });
  });

  it("falls back to in-memory limiting when centralized store is unavailable", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = "token";

    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      enforceAuthLoginRateLimit({
        clientKey: "203.0.113.9",
        accountKey: "nurse@example.com",
      }),
    ).resolves.toBeUndefined();

    await expect(
      enforceAuthLoginRateLimit({
        clientKey: "203.0.113.9",
        accountKey: "nurse@example.com",
      }),
    ).rejects.toThrow("Too many login attempts. Please try again shortly.");

    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to default config values when env values are invalid", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "0";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "invalid";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "-1";

    for (let index = 0; index < 5; index += 1) {
      await expect(
        enforceAuthLoginRateLimit({ clientKey: "203.0.113.22" }),
      ).resolves.toBeUndefined();
    }

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.22" })).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("resets in-memory buckets after the configured window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T10:00:00.000Z"));
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "1000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "1";

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.31" })).resolves.toBeUndefined();
    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.31" })).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );

    vi.setSystemTime(new Date("2026-03-18T10:00:01.100Z"));
    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.31" })).resolves.toBeUndefined();

    vi.useRealTimers();
  });

  it("applies account-keyed memory throttling across different clients", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    await expect(
      enforceAuthLoginRateLimit({
        clientKey: "203.0.113.40",
        accountKey: "nurse@example.com",
      }),
    ).resolves.toBeUndefined();

    await expect(
      enforceAuthLoginRateLimit({
        clientKey: "203.0.113.41",
        accountKey: "nurse@example.com",
      }),
    ).rejects.toThrow("Too many login attempts. Please try again shortly.");
  });

  it("enforces centralized lock ttl from upstash", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = "token";

    fetchMock.mockResolvedValue(buildUpstashResponse([{ result: 12 }]));

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.51" })).rejects.toMatchObject({
      status: 429,
      headers: { "Retry-After": "12" },
    });
  });

  it("supports successful upstash increments and sets ttl when missing", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "2";

    fetchMock
      .mockResolvedValueOnce(buildUpstashResponse([{ result: -1 }]))
      .mockResolvedValueOnce(buildUpstashResponse([{ result: 1 }, { result: -1 }]))
      .mockResolvedValueOnce(buildUpstashResponse([{ result: 1 }]));

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.61" })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("creates centralized lock when upstash counter exceeds max requests", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "9";

    fetchMock
      .mockResolvedValueOnce(buildUpstashResponse([{ result: -1 }]))
      .mockResolvedValueOnce(buildUpstashResponse([{ result: 2 }, { result: 30 }]))
      .mockResolvedValueOnce(buildUpstashResponse([{ result: "OK" }]));

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.71" })).rejects.toMatchObject({
      status: 429,
      headers: { "Retry-After": "9" },
    });
  });

  it("falls back to memory mode when upstash returns invalid counter payloads", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN = "token";

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const commands = JSON.parse(String(init?.body)) as string[][];
      const firstCommand = commands[0]?.[0];

      if (firstCommand === "TTL") {
        return buildUpstashResponse([{ result: -1 }]);
      }

      if (firstCommand === "INCR") {
        return buildUpstashResponse([{ result: "bad-count" }, { result: 20 }]);
      }

      return buildUpstashResponse([]);
    });

    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.81" })).resolves.toBeUndefined();
    await expect(enforceAuthLoginRateLimit({ clientKey: "203.0.113.81" })).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });
});
