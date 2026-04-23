import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetOptimizeRouteRateLimitForTests } from "../requestGuards";

const {
  requireAuthMock,
  recordOptimizationRunMock,
  listScheduledVisitInstancesForOptimizationMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  recordOptimizationRunMock: vi.fn(),
  listScheduledVisitInstancesForOptimizationMock: vi.fn(),
}));

vi.mock("./optimizeRouteService", () => ({
  optimizeRouteV3: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/dashboard/dashboardRepository", () => ({
  recordOptimizationRun: recordOptimizationRunMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceRepository", () => ({
  listScheduledVisitInstancesForOptimization: listScheduledVisitInstancesForOptimizationMock,
}));

import { optimizeRouteV3 } from "./optimizeRouteService";
import { OPTIONS, POST } from "./route";

const mockedOptimizeRouteV3 = vi.mocked(optimizeRouteV3);

const validRequestBody = {
  planningDate: "2026-03-13",
  timezone: "America/Toronto",
  start: {
    address: "Start Address",
  },
  end: {
    address: "End Address",
  },
  visits: [],
};

let requestCounter = 0;

const buildPostRequest = (body: string, headers?: Record<string, string>) => {
  requestCounter += 1;

  return new Request("http://localhost:3000/api/optimize-route/v3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.2.2.${requestCounter}`,
      ...(headers ?? {}),
    },
    body,
  });
};

describe("optimize-route v3 route handler", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalShadowCompare = process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE;
  const originalShadowSampleRate = process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    mockedOptimizeRouteV3.mockReset();
    requireAuthMock.mockReset();
    recordOptimizationRunMock.mockReset();
    listScheduledVisitInstancesForOptimizationMock.mockReset();
    listScheduledVisitInstancesForOptimizationMock.mockResolvedValue({
      visits: [],
      instanceMetaByVisitId: new Map(),
    });
    recordOptimizationRunMock.mockResolvedValue(undefined);
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    __resetOptimizeRouteRateLimitForTests();
    requestCounter = 0;
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    __resetOptimizeRouteRateLimitForTests();

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

    if (originalShadowCompare === undefined) {
      delete process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE;
    } else {
      process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE = originalShadowCompare;
    }

    if (originalShadowSampleRate === undefined) {
      delete process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE;
    } else {
      process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE = originalShadowSampleRate;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("returns OPTIONS preflight response with CORS headers", async () => {
    const response = await OPTIONS(new Request("http://localhost:3000/api/optimize-route/v3"));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns a shaped success response payload", async () => {
    mockedOptimizeRouteV3.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T11:30:00.000Z",
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
      algorithmVersion: "v3.0.0-ils-seeded",
    });

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.algorithmVersion).toBe("v3.0.0-ils-seeded");
    expect(mockedOptimizeRouteV3).toHaveBeenCalledTimes(1);
    expect(recordOptimizationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nurseId: "nurse-1",
        endpointVersion: "v3",
      }),
    );
  });

  it("passes sampled shadow context to the v3 optimizer", async () => {
    process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE = "true";
    process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE = "1";

    mockedOptimizeRouteV3.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T11:30:00.000Z",
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
      algorithmVersion: "v3.0.0-ils-seeded",
    });

    await POST(
      buildPostRequest(JSON.stringify(validRequestBody), {
        "x-request-id": "req-shadow-1",
      }),
    );

    expect(mockedOptimizeRouteV3).toHaveBeenCalledWith(expect.anything(), "test-key", {
      requestId: "req-shadow-1",
      nurseId: "nurse-1",
      shadowCompare: true,
    });
  });

  it("uses scheduled visit instances as fallback when request visits are empty", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    listScheduledVisitInstancesForOptimizationMock.mockResolvedValue({
      visits: [
        {
          visitId: "provided-1",
          patientId: "client-1",
          patientName: "Client One",
          address: "100 Main St",
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
      ],
      instanceMetaByVisitId: new Map([
        [
          "provided-1",
          {
            instanceId: "provided-1",
            templateId: "template-1",
          },
        ],
      ]),
    });

    mockedOptimizeRouteV3.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T11:30:00.000Z",
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
      algorithmVersion: "v3.0.0-ils-seeded",
    });

    const response = await POST(buildPostRequest(JSON.stringify(validRequestBody)));
    expect(response.status).toBe(200);
    expect(listScheduledVisitInstancesForOptimizationMock).toHaveBeenCalledWith(
      "nurse-1",
      "2026-03-13",
    );

    const [optimizerRequest] = mockedOptimizeRouteV3.mock.calls[0];
    expect(optimizerRequest.visits).toEqual([
      expect.objectContaining({ visitId: "provided-1", patientId: "client-1" }),
    ]);
    expect(recordOptimizationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceMetaByVisitId: expect.any(Map),
      }),
    );
  });

  it("queries scheduled instances for metadata when request already has visits", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    listScheduledVisitInstancesForOptimizationMock.mockResolvedValue({
      visits: [
        {
          visitId: "provided-1",
          patientId: "client-1",
          patientName: "Client One",
          address: "100 Main St",
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
      ],
      instanceMetaByVisitId: new Map([
        [
          "provided-1",
          {
            instanceId: "provided-1",
            templateId: "template-1",
          },
        ],
      ]),
    });

    mockedOptimizeRouteV3.mockResolvedValue({
      start: {
        address: "Start Address",
        coords: { lat: 43.6, lon: -79.6 },
        departureTime: "2026-03-13T11:30:00.000Z",
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
      algorithmVersion: "v3.0.0-ils-seeded",
    });

    const requestWithVisits = {
      ...validRequestBody,
      visits: [
        {
          visitId: "provided-1",
          patientId: "client-1",
          patientName: "Client One",
          address: "100 Main St",
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
      ],
    };

    const response = await POST(buildPostRequest(JSON.stringify(requestWithVisits)));
    expect(response.status).toBe(200);
    expect(listScheduledVisitInstancesForOptimizationMock).toHaveBeenCalledWith(
      "nurse-1",
      "2026-03-13",
    );

    const [optimizerRequest] = mockedOptimizeRouteV3.mock.calls[0];
    expect(optimizerRequest.visits).toEqual(requestWithVisits.visits);

    expect(recordOptimizationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceMetaByVisitId: expect.any(Map),
      }),
    );
  });
});
