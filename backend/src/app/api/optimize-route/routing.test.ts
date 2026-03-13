import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";
import type { GeocodedStop, OrderedStop } from "./types";

const START_STOP: GeocodedStop = {
  address: "Start",
  coords: { lat: 43.6, lon: -79.6 },
};

const MID_STOP: OrderedStop = {
  address: "Mid",
  coords: { lat: 43.61, lon: -79.61 },
  distanceFromPreviousKm: 0,
  durationFromPreviousSeconds: 0,
};

const SAME_COORDS_STOP: OrderedStop = {
  address: "Same",
  coords: { lat: 43.6, lon: -79.6 },
  distanceFromPreviousKm: 0,
  durationFromPreviousSeconds: 0,
};

describe("routing helpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computes nearest-neighbor route order and appends end stop", () => {
    const start: GeocodedStop = {
      address: "Start",
      coords: { lat: 0, lon: 0 },
    };
    const stopA: GeocodedStop = {
      address: "A",
      coords: { lat: 0.01, lon: 0.01 },
    };
    const stopB: GeocodedStop = {
      address: "B",
      coords: { lat: 5, lon: 5 },
    };
    const end: GeocodedStop = {
      address: "End",
      coords: { lat: 0.02, lon: 0.02 },
    };

    const ordered = computeNearestNeighborRoute(start, [stopB, stopA], end);

    expect(ordered.map((stop) => stop.address)).toEqual(["A", "B", "End"]);
    expect(ordered[2].isEndingPoint).toBe(true);
    expect(ordered.every((stop) => typeof stop.distanceFromPreviousKm === "number")).toBe(true);
  });

  it("returns only ending point when there are no intermediate stops", () => {
    const end: GeocodedStop = {
      address: "End",
      coords: { lat: 43.7, lon: -79.7 },
    };

    const ordered = computeNearestNeighborRoute(START_STOP, [], end);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].isEndingPoint).toBe(true);
  });

  it("keeps the first candidate when later candidate is farther", () => {
    const start: GeocodedStop = {
      address: "Start",
      coords: { lat: 0, lon: 0 },
    };
    const near: GeocodedStop = {
      address: "Near",
      coords: { lat: 0.01, lon: 0.01 },
    };
    const far: GeocodedStop = {
      address: "Far",
      coords: { lat: 5, lon: 5 },
    };
    const end: GeocodedStop = {
      address: "End",
      coords: { lat: 6, lon: 6 },
    };

    const ordered = computeNearestNeighborRoute(start, [near, far], end);
    expect(ordered[0].address).toBe("Near");
  });

  it("builds driving route totals and stop enrichment from leg responses", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 2500,
            duration: "300s",
            polyline: { encodedPolyline: "abc" },
          },
        ],
      }),
    } as Response);

    const result = await buildDrivingRoute(START_STOP, [MID_STOP], "api-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.totalDistanceMeters).toBe(2500);
    expect(result.totalDistanceKm).toBe(2.5);
    expect(result.totalDurationSeconds).toBe(300);
    expect(result.routeLegs[0]).toMatchObject({
      fromAddress: "Start",
      toAddress: "Mid",
      durationSeconds: 300,
      encodedPolyline: "abc",
    });
    expect(result.orderedStops[0].distanceFromPreviousKm).toBe(2.5);
  });

  it("short-circuits same-coordinate legs without calling Google Routes", async () => {
    const result = await buildDrivingRoute(START_STOP, [SAME_COORDS_STOP], "api-key");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.totalDistanceMeters).toBe(0);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.totalDurationSeconds).toBe(0);
    expect(result.routeLegs).toEqual([
      {
        fromAddress: "Start",
        toAddress: "Same",
        distanceMeters: 0,
        durationSeconds: 0,
        encodedPolyline: "",
      },
    ]);
    expect(result.orderedStops[0].distanceFromPreviousKm).toBe(0);
    expect(result.orderedStops[0].durationFromPreviousSeconds).toBe(0);
  });

  it("calls Google only for non-zero legs when route includes duplicate coordinates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 2500,
            duration: "300s",
            polyline: { encodedPolyline: "abc" },
          },
        ],
      }),
    } as Response);

    const result = await buildDrivingRoute(START_STOP, [SAME_COORDS_STOP, MID_STOP], "api-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.routeLegs).toHaveLength(2);
    expect(result.routeLegs[0]).toEqual({
      fromAddress: "Start",
      toAddress: "Same",
      distanceMeters: 0,
      durationSeconds: 0,
      encodedPolyline: "",
    });
    expect(result.routeLegs[1]).toMatchObject({
      fromAddress: "Same",
      toAddress: "Mid",
      distanceMeters: 2500,
      durationSeconds: 300,
      encodedPolyline: "abc",
    });
    expect(result.totalDistanceMeters).toBe(2500);
    expect(result.totalDistanceKm).toBe(2.5);
    expect(result.totalDurationSeconds).toBe(300);
    expect(result.orderedStops[0].distanceFromPreviousKm).toBe(0);
    expect(result.orderedStops[0].durationFromPreviousSeconds).toBe(0);
    expect(result.orderedStops[1].distanceFromPreviousKm).toBe(2.5);
    expect(result.orderedStops[1].durationFromPreviousSeconds).toBe(300);
  });

  it("returns empty aggregates when orderedStops is empty", async () => {
    const result = await buildDrivingRoute(START_STOP, [], "api-key");

    expect(result).toEqual({
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    });
  });

  it("maps fetch failures to unavailable driving service error", async () => {
    fetchMock.mockRejectedValue(new Error("network"));

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Driving route service is currently unavailable.",
    });
  });

  it("maps 401/403 responses to API key authorization errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 500,
      message: "Google Routes API key is invalid or not authorized.",
    });
  });

  it("maps 429 responses to driving rate-limit errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Driving route service is rate-limited. Please try again shortly.",
    });
  });

  it("maps unexpected non-ok responses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Driving route service returned an unexpected error.",
    });
  });

  it("maps missing route payloads", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "No driving route was found for one of the trip legs.",
    });
  });

  it("accepts string distance values returned by Google Routes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: "2500", duration: "300s", polyline: { encodedPolyline: "abc" } }],
      }),
    } as Response);

    const result = await buildDrivingRoute(START_STOP, [MID_STOP], "api-key");

    expect(result.totalDistanceMeters).toBe(2500);
    expect(result.totalDistanceKm).toBe(2.5);
    expect(result.routeLegs[0].distanceMeters).toBe(2500);
  });

  it("maps invalid route distance values", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: "bad", duration: "300s", polyline: { encodedPolyline: "abc" } }],
      }),
    } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Google Routes returned an invalid distance.",
    });
  });

  it("maps invalid route polyline values", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 1000, duration: "300s", polyline: { encodedPolyline: "" } }],
      }),
    } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Google Routes returned an invalid route path.",
    });
  });

  it("maps invalid duration format values", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 1000, duration: 300, polyline: { encodedPolyline: "abc" } }],
      }),
    } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Google Routes returned an invalid duration.",
    });
  });

  it("maps invalid duration numeric parsing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 1000, duration: "NaNs", polyline: { encodedPolyline: "abc" } }],
      }),
    } as Response);

    await expect(buildDrivingRoute(START_STOP, [MID_STOP], "api-key")).rejects.toMatchObject({
      status: 503,
      message: "Google Routes returned an invalid duration.",
    });
  });

  it("aborts timed-out Google Routes requests", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });

    const promise = buildDrivingRoute(START_STOP, [MID_STOP], "api-key");
    const assertion = expect(promise).rejects.toMatchObject({
      status: 503,
      message: "Driving route service is currently unavailable.",
    });

    await vi.advanceTimersByTimeAsync(10000);
    await assertion;

    vi.useRealTimers();
  });
});
