import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLoginRateLimitForTests, enforceLoginRateLimit } from "./requestGuards";

describe("auth request guards", () => {
  const originalRateLimitWindow = process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;

  beforeEach(() => {
    __resetLoginRateLimitForTests();
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
  });

  it("enforces per-client login rate limit", () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
      },
    });

    expect(() => enforceLoginRateLimit(request)).not.toThrow();
    expect(() => enforceLoginRateLimit(request)).toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("tracks forwarded clients independently", () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const requestA = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.1" },
    });
    const requestB = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.2" },
    });

    expect(() => enforceLoginRateLimit(requestA)).not.toThrow();
    expect(() => enforceLoginRateLimit(requestB)).not.toThrow();
  });

  it("uses x-real-ip when x-forwarded-for is absent", () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-real-ip": "198.51.100.5" },
    });

    expect(() => enforceLoginRateLimit(request)).not.toThrow();
    expect(() => enforceLoginRateLimit(request)).toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("uses anonymous bucket when no client ip headers exist", () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const request = new Request("http://localhost:3000/api/auth/login");

    expect(() => enforceLoginRateLimit(request)).not.toThrow();
    expect(() => enforceLoginRateLimit(request)).toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("falls back to default config values when env limits are invalid", () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "0";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "nope";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    for (let index = 0; index < 5; index += 1) {
      expect(() => enforceLoginRateLimit(request)).not.toThrow();
    }
    expect(() => enforceLoginRateLimit(request)).toThrow(
      "Too many login attempts. Please try again shortly.",
    );
  });

  it("resets counters after rate-limit window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T10:00:00.000Z"));
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "1000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.20" },
    });

    expect(() => enforceLoginRateLimit(request)).not.toThrow();
    expect(() => enforceLoginRateLimit(request)).toThrow(
      "Too many login attempts. Please try again shortly.",
    );

    vi.setSystemTime(new Date("2026-03-13T10:00:01.100Z"));

    expect(() => enforceLoginRateLimit(request)).not.toThrow();
    vi.useRealTimers();
  });
});
