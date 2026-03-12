import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";
import type { OptimizeRouteResult } from "./types";
import { __resetOptimizeRouteRateLimitForTests } from "./requestGuards";

vi.mock("./optimizeRouteService", () => ({
  optimizeRoute: vi.fn(),
}));

import { optimizeRoute } from "./optimizeRouteService";
import { OPTIONS, POST } from "./route";

const mockedOptimizeRoute = vi.mocked(optimizeRoute);

const validRequestBody = {
  startAddress: "Start Address",
  endAddress: "End Address",
  addresses: ["Stop A", "Stop B"],
};

let requestCounter = 0;

const buildPostRequest = (body: string, extraHeaders?: Record<string, string>) => {
  requestCounter += 1;

  return new Request("http://localhost:3000/api/optimize-route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.1.${requestCounter}`,
      ...extraHeaders,
    },
    body,
  });
};

describe("optimize-route route handler", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalOptimizeRouteApiKey = process.env.OPTIMIZE_ROUTE_API_KEY;
  const originalRateLimitWindow = process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS;

  beforeEach(() => {
    mockedOptimizeRoute.mockReset();
    __resetOptimizeRouteRateLimitForTests();
    requestCounter = 0;
  });

  afterEach(() => {
    __resetOptimizeRouteRateLimitForTests();

    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    }

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

  it("returns 500 when GOOGLE_MAPS_API_KEY is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Server is missing GOOGLE_MAPS_API_KEY configuration.",
    });
  });

  it("returns OPTIONS preflight response with CORS headers", async () => {
    const response = await OPTIONS(new Request("http://localhost:3000/api/optimize-route"));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, x-optimize-route-key",
    );
  });

  it("returns 401 when OPTIMIZE_ROUTE_API_KEY is configured but request header is missing", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    process.env.OPTIMIZE_ROUTE_API_KEY = "secret-key";

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Missing or invalid optimize-route API key." });
  });

  it("accepts matching x-optimize-route-key header when OPTIMIZE_ROUTE_API_KEY is configured", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    process.env.OPTIMIZE_ROUTE_API_KEY = "secret-key";

    mockedOptimizeRoute.mockResolvedValue({
      start: { address: "Start Address", coords: { lat: 0, lon: 0 } },
      end: { address: "End Address", coords: { lat: 1, lon: 1 } },
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    });

    const response = await POST(
      buildPostRequest(JSON.stringify(validRequestBody), {
        "x-optimize-route-key": "secret-key",
      }),
    );

    expect(response.status).toBe(200);
  });

  it("returns 429 when optimize-route rate limit is exceeded", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_MAX_REQUESTS = "1";
    process.env.OPTIMIZE_ROUTE_RATE_LIMIT_WINDOW_MS = "60000";

    mockedOptimizeRoute.mockResolvedValue({
      start: { address: "Start Address", coords: { lat: 0, lon: 0 } },
      end: { address: "End Address", coords: { lat: 1, lon: 1 } },
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    });

    const firstResponse = await POST(
      buildPostRequest(JSON.stringify(validRequestBody), {
        "x-forwarded-for": "10.99.0.1",
      }),
    );
    const secondResponse = await POST(
      buildPostRequest(JSON.stringify(validRequestBody), {
        "x-forwarded-for": "10.99.0.1",
      }),
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      error: "Too many optimize route requests. Please try again shortly.",
    });
  });

  it("maps invalid JSON request bodies to 400", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";

    const response = await POST(buildPostRequest("{not-valid-json"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Request body must be valid JSON." });
  });

  it("maps HttpError from service to its status and message", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRoute.mockRejectedValue(new HttpError(422, "Unprocessable route request."));

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toEqual({ error: "Unprocessable route request." });
  });

  it("maps unknown service errors to generic 500", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRoute.mockRejectedValue(new Error("Unexpected explosion"));

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Failed to optimize route." });
  });

  it("returns shaped success response payload from optimize service", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";

    const optimizedResult: OptimizeRouteResult = {
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
      },
      end: {
        address: "End Address",
        coords: { lat: 43.7, lon: -79.7 },
      },
      orderedStops: [
        {
          address: "Stop A",
          coords: { lat: 43.61, lon: -79.61 },
          distanceFromPreviousKm: 4.5,
          durationFromPreviousSeconds: 420,
        },
        {
          address: "End Address",
          coords: { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 6.2,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start Address",
          toAddress: "Stop A",
          distanceMeters: 4500,
          durationSeconds: 420,
          encodedPolyline: "abc",
        },
        {
          fromAddress: "Stop A",
          toAddress: "End Address",
          distanceMeters: 6200,
          durationSeconds: 600,
          encodedPolyline: "def",
        },
      ],
      totalDistanceMeters: 10700,
      totalDistanceKm: 10.7,
      totalDurationSeconds: 1020,
    };

    mockedOptimizeRoute.mockResolvedValue(optimizedResult);

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = (await response.json()) as OptimizeRouteResult;

    expect(response.status).toBe(200);
    expect(payload).toEqual(optimizedResult);
    expect(mockedOptimizeRoute).toHaveBeenCalledWith(
      {
        startAddress: "Start Address",
        endAddress: "End Address",
        destinations: [
          { address: "Stop A", googlePlaceId: null },
          { address: "Stop B", googlePlaceId: null },
        ],
      },
      "test-key",
    );
  });

  it("accepts destinations payload and forwards normalized patient-linked destinations", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";

    mockedOptimizeRoute.mockResolvedValue({
      start: { address: "Start Address", coords: { lat: 0, lon: 0 } },
      end: { address: "End Address", coords: { lat: 1, lon: 1 } },
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    });

    const response = await POST(
      buildPostRequest(
        JSON.stringify({
          startAddress: "Start Address",
          endAddress: "End Address",
          destinations: [
            {
              patientId: " patient-1 ",
              patientName: " Jane Doe ",
              address: " 100 Main St ",
              googlePlaceId: " place-1 ",
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedOptimizeRoute).toHaveBeenCalledWith(
      {
        startAddress: "Start Address",
        endAddress: "End Address",
        destinations: [
          {
            patientId: "patient-1",
            patientName: "Jane Doe",
            address: "100 Main St",
            googlePlaceId: "place-1",
          },
        ],
      },
      "test-key",
    );
  });

  it("maps invalid optimize service response shape to 500", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRoute.mockResolvedValue({ invalid: true } as never);

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Failed to shape optimize-route response." });
  });
});
