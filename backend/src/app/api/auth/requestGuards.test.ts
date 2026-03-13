import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});
