import { afterEach, describe, expect, it } from "vitest";
import { HttpError, buildCorsHeaders, toErrorResponse } from "./http";

describe("http helpers", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("uses wildcard CORS origin when ALLOWED_ORIGINS is not configured", () => {
    delete process.env.ALLOWED_ORIGINS;

    const headers = buildCorsHeaders(new Request("http://localhost:3000/api/test"), {
      methods: "GET, OPTIONS",
    });

    expect(headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  });

  it("throws when strict policy is used without ALLOWED_ORIGINS", () => {
    delete process.env.ALLOWED_ORIGINS;

    expect(() =>
      buildCorsHeaders(new Request("http://localhost:3000/api/test"), {
        methods: "GET, OPTIONS",
        originPolicy: "strict",
      }),
    ).toThrowError("Server is missing ALLOWED_ORIGINS configuration.");
  });

  it("returns request origin when it is allowed", () => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com, https://other.example.com";

    const headers = buildCorsHeaders(
      new Request("http://localhost:3000/api/test", {
        headers: { origin: "https://other.example.com" },
      }),
      { methods: "POST, OPTIONS" },
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://other.example.com");
  });

  it("returns first configured origin for fallback policy on disallowed origin", () => {
    process.env.ALLOWED_ORIGINS = "https://first.example.com, https://second.example.com";

    const headers = buildCorsHeaders(
      new Request("http://localhost:3000/api/test", {
        headers: { origin: "https://disallowed.example.com" },
      }),
      { methods: "GET, OPTIONS", originPolicy: "fallback-first" },
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://first.example.com");
  });

  it("throws HttpError for strict policy on disallowed origin", () => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com";

    expect(() =>
      buildCorsHeaders(
        new Request("http://localhost:3000/api/test", {
          headers: { origin: "https://disallowed.example.com" },
        }),
        { methods: "GET, OPTIONS", originPolicy: "strict" },
      ),
    ).toThrowError("Origin is not allowed.");
  });

  it("adds security headers when requested", () => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com";

    const headers = buildCorsHeaders(
      new Request("https://api.example.com/api/test", {
        headers: { origin: "https://allowed.example.com" },
      }),
      {
        methods: "POST, OPTIONS",
        originPolicy: "strict",
        includeSecurityHeaders: true,
      },
    );

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
  });

  it("maps HttpError to JSON response with same status", async () => {
    const response = toErrorResponse(
      new HttpError(418, "Teapot."),
      "Fallback",
      { "x-test": "1" },
    );

    expect(response.status).toBe(418);
    expect(response.headers.get("x-test")).toBe("1");
    await expect(response.json()).resolves.toEqual({ error: "Teapot." });
  });

  it("merges HttpError headers with response headers", async () => {
    const response = toErrorResponse(
      new HttpError(429, "Too many attempts.", {
        headers: { "Retry-After": "30" },
      }),
      "Fallback",
      { "x-test": "1" },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("x-test")).toBe("1");
    expect(response.headers.get("Retry-After")).toBe("30");
    await expect(response.json()).resolves.toEqual({ error: "Too many attempts." });
  });

  it("maps unknown error to fallback 500 response", async () => {
    const response = toErrorResponse(new Error("Boom"), "Fallback message");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Fallback message" });
  });
});
