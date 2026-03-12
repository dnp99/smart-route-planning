import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetOptimizeRouteRateLimitForTests,
  enforceOptimizeRouteRateLimit,
  requireOptimizeRouteApiKey,
} from "./requestGuards";

describe("optimize-route request guards", () => {
  const originalOptimizeRouteApiKey = process.env.OPTIMIZE_ROUTE_API_KEY;
  const originalRateLimitWindow = process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS;

  beforeEach(() => {
    __resetOptimizeRouteRateLimitForTests();
  });

  afterEach(() => {
    __resetOptimizeRouteRateLimitForTests();
    vi.restoreAllMocks();

    if (originalOptimizeRouteApiKey === undefined) {
      delete process.env.OPTIMIZE_ROUTE_API_KEY;
    } else {
      process.env.OPTIMIZE_ROUTE_API_KEY = originalOptimizeRouteApiKey;
    }

    if (originalRateLimitWindow === undefined) {
      delete process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = originalRateLimitWindow;
    }

    if (originalRateLimitMax === undefined) {
      delete process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = originalRateLimitMax;
    }
  });

  it("skips API key enforcement when OPTIMIZE_ROUTE_API_KEY is not configured", () => {
    delete process.env.OPTIMIZE_ROUTE_API_KEY;

    expect(() =>
      requireOptimizeRouteApiKey(new Request("http://localhost:3000/api/optimize-route")),
    ).not.toThrow();
  });

  it("throws when configured API key header is missing", () => {
    process.env.OPTIMIZE_ROUTE_API_KEY = "secret-key";

    expect(() =>
      requireOptimizeRouteApiKey(new Request("http://localhost:3000/api/optimize-route")),
    ).toThrow("Missing or invalid optimize-route API key.");
  });

  it("throws when configured API key header does not match", () => {
    process.env.OPTIMIZE_ROUTE_API_KEY = "secret-key";

    expect(() =>
      requireOptimizeRouteApiKey(
        new Request("http://localhost:3000/api/optimize-route", {
          headers: { "x-optimize-route-key": "wrong" },
        }),
      ),
    ).toThrow("Missing or invalid optimize-route API key.");
  });

  it("accepts matching configured API key", () => {
    process.env.OPTIMIZE_ROUTE_API_KEY = "secret-key";

    expect(() =>
      requireOptimizeRouteApiKey(
        new Request("http://localhost:3000/api/optimize-route", {
          headers: { "x-optimize-route-key": "secret-key" },
        }),
      ),
    ).not.toThrow();
  });

  it("enforces per-client optimize-route rate limit", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "1000";

    const request = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(request)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );
  });

  it("allows requests within limit before throwing on the next one", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "1000";

    const request = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "10.0.0.55" },
    });

    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(request)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );
  });

  it("resets rate-limit window after elapsed time", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "1000";

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(0);
    nowSpy.mockReturnValueOnce(500);
    nowSpy.mockReturnValueOnce(1200);

    const request = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });

    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(request)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );
    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
  });

  it("uses fallback defaults when rate-limit env values are invalid", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "0";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "-10";

    const request = new Request("http://localhost:3000/api/optimize-route");
    expect(() => enforceOptimizeRouteRateLimit(request)).not.toThrow();
  });

  it("prefers x-forwarded-for, then x-real-ip, then anonymous for client identity", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "60000";

    const forwardedRequestA = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "10.0.0.3, 10.0.0.4", "x-real-ip": "192.168.0.1" },
    });
    const forwardedRequestB = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "10.0.0.3, 10.0.0.99", "x-real-ip": "192.168.0.99" },
    });

    expect(() => enforceOptimizeRouteRateLimit(forwardedRequestA)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(forwardedRequestB)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );

    __resetOptimizeRouteRateLimitForTests();

    const realIpRequestA = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-real-ip": "192.168.1.10" },
    });
    const realIpRequestB = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": "   ", "x-real-ip": "192.168.1.10" },
    });

    expect(() => enforceOptimizeRouteRateLimit(realIpRequestA)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(realIpRequestB)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );

    __resetOptimizeRouteRateLimitForTests();

    const anonymousRequestA = new Request("http://localhost:3000/api/optimize-route");
    const anonymousRequestB = new Request("http://localhost:3000/api/optimize-route");

    expect(() => enforceOptimizeRouteRateLimit(anonymousRequestA)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(anonymousRequestB)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );
  });

  it("falls back to anonymous when first x-forwarded-for segment is blank and no x-real-ip", () => {
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "60000";

    const anonymousRequest = new Request("http://localhost:3000/api/optimize-route");
    const malformedForwardedRequest = new Request("http://localhost:3000/api/optimize-route", {
      headers: { "x-forwarded-for": ", 10.0.0.8" },
    });

    expect(() => enforceOptimizeRouteRateLimit(anonymousRequest)).not.toThrow();
    expect(() => enforceOptimizeRouteRateLimit(malformedForwardedRequest)).toThrow(
      "Too many optimize route requests. Please try again shortly.",
    );
  });
});
