import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetLoginRateLimitForTests,
  enforceLoginRateLimit,
  requireSecureAuthTransport,
} from "./requestGuards";

describe("auth request guards", () => {
  const originalRateLimitWindow = process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
  const originalLockout = process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;
  const originalUpstashUrl = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    __resetLoginRateLimitForTests();
    delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_URL;
    delete process.env.AUTH_LOGIN_RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    __resetLoginRateLimitForTests();

    if (originalRateLimitWindow === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = originalRateLimitWindow;
    }

    if (originalRateLimitMax === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = originalRateLimitMax;
    }

    if (originalLockout === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = originalLockout;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAuthEnforceHttps === undefined) {
      delete process.env.AUTH_ENFORCE_HTTPS;
    } else {
      process.env.AUTH_ENFORCE_HTTPS = originalAuthEnforceHttps;
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

  it("enforces per-client login rate limit", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "30";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
      },
    });

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(request)).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("tracks forwarded clients independently", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const requestA = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.1" },
    });
    const requestB = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.2" },
    });

    await expect(enforceLoginRateLimit(requestA)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(requestB)).resolves.toBeUndefined();
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "30";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-real-ip": "198.51.100.5" },
    });

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(request)).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("uses anonymous bucket when no client ip headers exist", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "30";

    const request = new Request("http://localhost:3000/api/auth/login");

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(request)).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("falls back to default config values when env limits are invalid", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "0";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "nope";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "bad";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    for (let index = 0; index < 5; index += 1) {
      await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    }
    await expect(enforceLoginRateLimit(request)).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("resets counters after rate-limit window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T10:00:00.000Z"));
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "1000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "1";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.20" },
    });

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(request)).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );

    vi.setSystemTime(new Date("2026-03-13T10:00:01.100Z"));

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("applies account-keyed throttling across different client IPs", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "30";

    const firstRequest = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.100" },
    });
    const secondRequest = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.101" },
    });

    await expect(enforceLoginRateLimit(firstRequest, "nurse@example.com")).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(secondRequest, "nurse@example.com")).rejects.toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("adds retry-after header when lockout is active", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_SECONDS = "15";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.30" },
    });

    await expect(enforceLoginRateLimit(request)).resolves.toBeUndefined();
    await expect(enforceLoginRateLimit(request)).rejects.toMatchObject({
      status: 429,
      headers: { "Retry-After": "15" },
    });
  });

  it("requires secure transport in production", () => {
    process.env.NODE_ENV = "production";

    expect(() =>
      requireSecureAuthTransport(new Request("http://localhost:3000/api/auth/login")),
    ).toThrow("HTTPS is required for authentication endpoints.");
  });

  it("accepts secure transport when forwarded proto is https", () => {
    process.env.NODE_ENV = "production";

    expect(() =>
      requireSecureAuthTransport(
        new Request("http://localhost:3000/api/auth/login", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).not.toThrow();
  });
});
