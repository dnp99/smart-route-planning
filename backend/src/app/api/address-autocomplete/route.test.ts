import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadRouteModule = async () => {
  vi.resetModules();
  return import("./route");
};

const buildGetRequest = (query: string, headers?: HeadersInit) =>
  new Request(`http://localhost:3000/api/address-autocomplete?query=${encodeURIComponent(query)}`, {
    method: "GET",
    headers,
  });

const buildOptionsRequest = (headers?: HeadersInit) =>
  new Request("http://localhost:3000/api/address-autocomplete", {
    method: "OPTIONS",
    headers,
  });

describe("address-autocomplete route", () => {
  const fetchMock = vi.fn();
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();

    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("handles OPTIONS preflight for allowed origin", async () => {
    const { OPTIONS } = await loadRouteModule();
    const response = await OPTIONS(buildOptionsRequest({ origin: "http://localhost:5173" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("rejects OPTIONS preflight for disallowed origin", async () => {
    const { OPTIONS } = await loadRouteModule();
    const response = await OPTIONS(buildOptionsRequest({ origin: "http://evil.example.com" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin is not allowed." });
  });

  it("returns 500 when API key is missing", async () => {
    const { GET } = await loadRouteModule();
    delete process.env.GOOGLE_MAPS_API_KEY;

    const response = await GET(
      buildGetRequest("toronto", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.1",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Server is missing GOOGLE_MAPS_API_KEY configuration.",
    });
  });

  it("returns empty suggestions for short query without fetching", async () => {
    const { GET } = await loadRouteModule();
    const response = await GET(
      buildGetRequest("ab", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.2",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles missing query parameter as empty query", async () => {
    const { GET } = await loadRouteModule();
    const response = await GET(
      new Request("http://localhost:3000/api/address-autocomplete", {
        method: "GET",
        headers: { origin: "http://localhost:5173", "x-forwarded-for": "10.0.0.16" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
  });

  it("maps overlong query validation failures to 400", async () => {
    const { GET } = await loadRouteModule();
    const response = await GET(
      buildGetRequest("x".repeat(201), {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.3",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Query must be at most 200 characters.",
    });
  });

  it("returns mapped suggestions for successful fetch", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "abc",
              text: { text: "123 Test St" },
            },
          },
        ],
      }),
    } as Response);

    const response = await GET(
      buildGetRequest("123 test", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.4",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestions: [{ displayName: "123 Test St", placeId: "abc" }],
    });
  });

  it("returns cache hit without second upstream fetch", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "cached-id",
              text: { text: "Cached Place" },
            },
          },
        ],
      }),
    } as Response);

    const first = await GET(
      buildGetRequest("cached query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.5",
      }),
    );
    const second = await GET(
      buildGetRequest("cached query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.5",
      }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes cache after TTL expiry", async () => {
    vi.useFakeTimers();
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "cached-id",
              text: { text: "Cached Place" },
            },
          },
        ],
      }),
    } as Response);

    await GET(
      buildGetRequest("ttl query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.14",
      }),
    );

    await vi.advanceTimersByTimeAsync(61_000);

    await GET(
      buildGetRequest("ttl query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.14",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 429 when rate limit is exceeded for same client", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);

    await GET(
      buildGetRequest("first query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.6",
      }),
    );

    const second = await GET(
      buildGetRequest("second query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.6",
      }),
    );

    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toEqual({
      error: "Please wait before requesting more address suggestions.",
    });
  });

  it("maps upstream fetch network errors", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockRejectedValue(new Error("network"));

    const response = await GET(
      buildGetRequest("network fail", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.7",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Address suggestion service is currently unavailable.",
    });
  });

  it("maps 401/403 upstream responses to API-key errors", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);

    const response = await GET(
      buildGetRequest("auth fail", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.8",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Google Places API key is invalid or not authorized.",
    });
  });

  it("maps 429 upstream responses to service rate-limit errors", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    const response = await GET(
      buildGetRequest("rate limit", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.9",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Address suggestion service is rate-limited. Please try again shortly.",
    });
  });

  it("maps unexpected non-ok upstream responses", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    const response = await GET(
      buildGetRequest("unexpected fail", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.10",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Address suggestion service returned an unexpected error.",
    });
  });

  it("maps invalid upstream payloads", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    const response = await GET(
      buildGetRequest("invalid payload", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.11",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Address suggestion service returned an invalid response.",
    });
  });

  it("filters malformed suggestion entries while returning valid ones", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          { placePrediction: { placeId: 123, text: { text: "bad" } } },
          { placePrediction: { placeId: "ok-id", text: { text: "Good Place" } } },
        ],
      }),
    } as Response);

    const response = await GET(
      buildGetRequest("mixed payload", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.12",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestions: [{ displayName: "Good Place", placeId: "ok-id" }],
    });
  });

  it("maps unknown runtime errors to generic autocomplete failure", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("unexpected parse failure");
      },
    } as Response);

    const response = await GET(
      buildGetRequest("json error", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.13",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch address suggestions.",
    });
  });

  it("supports x-real-ip when x-forwarded-for is absent", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);

    const response = await GET(
      buildGetRequest("real-ip query", {
        origin: "http://localhost:5173",
        "x-real-ip": "192.168.0.10",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
  });

  it("falls back from malformed x-forwarded-for to x-real-ip", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);

    const response = await GET(
      buildGetRequest("ip fallback", {
        origin: "http://localhost:5173",
        "x-forwarded-for": ", 10.0.0.99",
        "x-real-ip": "192.168.0.11",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
  });

  it("prioritizes x-forwarded-for first IP over x-real-ip", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);

    await GET(
      buildGetRequest("forwarded-priority-1", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.20, 10.0.0.21",
        "x-real-ip": "192.168.0.20",
      }),
    );

    const second = await GET(
      buildGetRequest("forwarded-priority-2", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.20, 10.0.0.21",
        "x-real-ip": "192.168.0.99",
      }),
    );

    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toEqual({
      error: "Please wait before requesting more address suggestions.",
    });
  });

  it("falls back to anonymous client key when IP headers are missing", async () => {
    const { GET } = await loadRouteModule();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);

    const response = await GET(
      buildGetRequest("anonymous query", {
        origin: "http://localhost:5173",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
  });

  it("aborts timed-out autocomplete requests", async () => {
    vi.useFakeTimers();
    const { GET } = await loadRouteModule();
    fetchMock.mockImplementation((_, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });

    const promise = GET(
      buildGetRequest("timeout query", {
        origin: "http://localhost:5173",
        "x-forwarded-for": "10.0.0.15",
      }),
    );

    await vi.advanceTimersByTimeAsync(8000);
    const response = await promise;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Address suggestion service is currently unavailable.",
    });
  });
});
