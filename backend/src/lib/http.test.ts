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

  it("maps unknown error to fallback 500 response", async () => {
    const response = toErrorResponse(new Error("Boom"), "Fallback message");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Fallback message" });
  });
});
