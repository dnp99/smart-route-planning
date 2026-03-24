import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";
import { __resetOptimizeRouteRateLimitForTests } from "../requestGuards";

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock("./optimizeRouteService", () => ({
  optimizeRouteV2: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

import { optimizeRouteV2 } from "./optimizeRouteService";
import { OPTIONS, POST } from "./route";

const mockedOptimizeRouteV2 = vi.mocked(optimizeRouteV2);

const validRequestBody = {
  planningDate: "2026-03-13",
  timezone: "America/Toronto",
  start: {
    address: "Start Address",
    departureTime: "2026-03-13T07:30:00-04:00",
  },
  end: {
    address: "End Address",
  },
  visits: [
    {
      visitId: "visit-1",
      patientId: "patient-1",
      patientName: "Jane Doe",
      address: "Stop A",
      windowStart: "08:30",
      windowEnd: "09:00",
      windowType: "fixed",
      serviceDurationMinutes: 20,
    },
  ],
};

let requestCounter = 0;

const buildPostRequest = (body: string, extraHeaders?: Record<string, string>) => {
  requestCounter += 1;

  return new Request("http://localhost:3000/api/optimize-route/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.1.1.${requestCounter}`,
      ...extraHeaders,
    },
    body,
  });
};

describe("optimize-route v2 route handler", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalOptimizeRouteApiKey = process.env.OPTIMIZE_ROUTE_API_KEY;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    mockedOptimizeRouteV2.mockReset();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    __resetOptimizeRouteRateLimitForTests();
    requestCounter = 0;
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
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

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("returns OPTIONS preflight response with CORS headers", async () => {
    const response = await OPTIONS(new Request("http://localhost:3000/api/optimize-route/v2"));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization, x-optimize-route-key",
    );
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

  it("returns 401 when authorization is missing or invalid", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    requireAuthMock.mockRejectedValue(
      new HttpError(401, "Missing or invalid authorization token."),
    );

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Missing or invalid authorization token." });
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
    mockedOptimizeRouteV2.mockRejectedValue(new HttpError(422, "Unprocessable route request."));

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toEqual({ error: "Unprocessable route request." });
  });

  it("returns shaped success response payload from optimize service", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRouteV2.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T11:30:00.000Z",
      },
      end: {
        address: "End Address",
        coords: { lat: 43.8, lon: -79.8 },
      },
      orderedStops: [
        {
          stopId: "stop-1",
          address: "Stop A",
          coords: { lat: 43.7, lon: -79.7 },
          arrivalTime: "2026-03-13T12:00:00.000Z",
          departureTime: "2026-03-13T12:20:00.000Z",
          tasks: [
            {
              visitId: "visit-1",
              patientId: "patient-1",
              patientName: "Jane Doe",
              address: "Stop A",
              windowStart: "08:30",
              windowEnd: "09:00",
              windowType: "fixed",
              serviceDurationMinutes: 20,
              arrivalTime: "2026-03-13T12:00:00.000Z",
              serviceStartTime: "2026-03-13T12:00:00.000Z",
              serviceEndTime: "2026-03-13T12:20:00.000Z",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 12.2,
          durationFromPreviousSeconds: 900,
        },
        {
          stopId: "stop-2",
          address: "End Address",
          coords: { lat: 43.8, lon: -79.8 },
          arrivalTime: "2026-03-13T12:40:00.000Z",
          departureTime: "2026-03-13T12:40:00.000Z",
          tasks: [],
          distanceFromPreviousKm: 3.1,
          durationFromPreviousSeconds: 1200,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromStopId: "start",
          toStopId: "stop-1",
          fromAddress: "Start Address",
          toAddress: "Stop A",
          distanceMeters: 12200,
          durationSeconds: 900,
          encodedPolyline: "abc",
        },
      ],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 15300,
        totalDistanceKm: 15.3,
        totalDurationSeconds: 2100,
      },
      algorithmVersion: "v2.1.0-greedy-window-first",
    });

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.metrics.totalDistanceKm).toBe(15.3);
    expect(mockedOptimizeRouteV2).toHaveBeenCalledWith(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start Address",
          departureTime: "2026-03-13T07:30:00-04:00",
        },
        end: {
          address: "End Address",
        },
        visits: [
          {
            visitId: "visit-1",
            patientId: "patient-1",
            patientName: "Jane Doe",
            address: "Stop A",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
        optimizationObjective: "distance",
      },
      "test-key",
    );
  });

  it("accepts requests without departureTime and passes parsed payload to service", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRouteV2.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T12:00:00.000Z",
      },
      end: {
        address: "End Address",
        coords: { lat: 43.8, lon: -79.8 },
      },
      orderedStops: [],
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
      },
      algorithmVersion: "v2.2.3-dynamic-departure-buffer",
    });

    const requestBodyWithoutDeparture = {
      ...validRequestBody,
      start: {
        address: "Start Address",
      },
    };

    const response = await POST(buildPostRequest(JSON.stringify(requestBodyWithoutDeparture)));

    expect(response.status).toBe(200);
    expect(mockedOptimizeRouteV2).toHaveBeenCalledWith(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start Address",
        },
        end: {
          address: "End Address",
        },
        visits: [
          {
            visitId: "visit-1",
            patientId: "patient-1",
            patientName: "Jane Doe",
            address: "Stop A",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
        optimizationObjective: "distance",
      },
      "test-key",
    );
  });

  it("passes preserveOrder=true to optimize service when provided", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRouteV2.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T12:00:00.000Z",
      },
      end: {
        address: "End Address",
        coords: { lat: 43.8, lon: -79.8 },
      },
      orderedStops: [],
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
      },
      algorithmVersion: "v2.5.1-edf-tier/preserved",
    });

    const requestWithPreserveOrder = {
      ...validRequestBody,
      preserveOrder: true,
    };

    const response = await POST(buildPostRequest(JSON.stringify(requestWithPreserveOrder)));

    expect(response.status).toBe(200);
    expect(mockedOptimizeRouteV2).toHaveBeenCalledWith(
      expect.objectContaining({
        preserveOrder: true,
      }),
      "test-key",
    );
  });

  it("returns 500 when optimize service returns an invalid response shape", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockedOptimizeRouteV2.mockResolvedValue({ invalid: true } as never);

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Failed to shape optimize-route v2 response." });
  });
});
