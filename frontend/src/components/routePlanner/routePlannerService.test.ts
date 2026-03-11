import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOptimizedRoute } from "./routePlannerService";

vi.mock("../apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

describe("requestOptimizedRoute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns optimize-route payload when response is valid", async () => {
    const payload = {
      start: { address: "Start", coords: { lat: 43.1, lon: -79.1 } },
      end: { address: "End", coords: { lat: 43.2, lon: -79.2 } },
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 1000,
      totalDistanceKm: 1,
      totalDurationSeconds: 120,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await requestOptimizedRoute({
      startAddress: "Start",
      endAddress: "End",
      addresses: ["A", "B"],
    });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/optimize-route",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAddress: "Start",
          endAddress: "End",
          addresses: ["A", "B"],
        }),
      },
    );
  });

  it("throws API-provided error message on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Detailed backend error" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        addresses: [],
      }),
    ).rejects.toThrow("Detailed backend error");
  });

  it("throws fallback error when non-ok response has no error string", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "not used" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        addresses: [],
      }),
    ).rejects.toThrow("Unable to optimize route.");
  });

  it("throws when payload shape is unexpected on ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "invalid-shape" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        addresses: [],
      }),
    ).rejects.toThrow("Unexpected API response format.");
  });
});
