import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetAuthLoginRateLimitForTests,
  enforceAuthLoginRateLimit,
} from "./authLoginRateLimit";

describe("authLoginRateLimit", () => {
  const originalWindow = process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const originalMax = process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
  const originalLockout = process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS;
  const originalUpstashUrl = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    __resetAuthLoginRateLimitForTests();
    vi.unstubAllGlobals();
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
    await expect(
      enforceAuthLoginRateLimit({ clientKey: "203.0.113.1" }),
    ).resolves.toBeUndefined();

    await expect(
      enforceAuthLoginRateLimit({ clientKey: "203.0.113.1" }),
    ).rejects.toMatchObject({
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
});
