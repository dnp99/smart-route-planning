import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";
import type { OptimizeRouteResult } from "./types";

vi.mock("./optimizeRouteService", () => ({
  optimizeRoute: vi.fn(),
}));

import { optimizeRoute } from "./optimizeRouteService";
import { POST } from "./route";

const mockedOptimizeRoute = vi.mocked(optimizeRoute);

const validRequestBody = {
  startAddress: "Start Address",
  endAddress: "End Address",
  addresses: ["Stop A", "Stop B"],
};

const buildPostRequest = (body: string) =>
  new Request("http://localhost:3000/api/optimize-route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

describe("optimize-route route handler", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    mockedOptimizeRoute.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
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
    expect(mockedOptimizeRoute).toHaveBeenCalledWith(validRequestBody, "test-key");
  });
});
