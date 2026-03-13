import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOptimizedRoute } from "../../components/routePlanner/routePlannerService";
import { setAuthSession } from "../../components/auth/authSession";

vi.mock("../../components/apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

describe("requestOptimizedRoute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    setAuthSession("test-token", {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
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
      destinations: [
        {
          address: "A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          googlePlaceId: null,
        },
        {
          address: "B",
          patientId: "patient-2",
          patientName: "John Doe",
          googlePlaceId: "place-2",
        },
      ],
    });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/optimize-route",
      {
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          startAddress: "Start",
          endAddress: "End",
          destinations: [
            {
              address: "A",
              patientId: "patient-1",
              patientName: "Jane Doe",
              googlePlaceId: null,
            },
            {
              address: "B",
              patientId: "patient-2",
              patientName: "John Doe",
              googlePlaceId: "place-2",
            },
          ],
        }),
      },
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("includes manual start and end place ids when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        start: { address: "Start", coords: { lat: 43.1, lon: -79.1 } },
        end: { address: "End", coords: { lat: 43.2, lon: -79.2 } },
        orderedStops: [],
        routeLegs: [],
        totalDistanceMeters: 1000,
        totalDistanceKm: 1,
        totalDurationSeconds: 120,
      }),
    } as Response);

    await requestOptimizedRoute({
      startAddress: "Start",
      startGooglePlaceId: "start-place",
      endAddress: "End",
      endGooglePlaceId: "end-place",
      destinations: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/optimize-route",
      {
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          startAddress: "Start",
          startGooglePlaceId: "start-place",
          endAddress: "End",
          endGooglePlaceId: "end-place",
          destinations: [],
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
        destinations: [],
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
        destinations: [],
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
        destinations: [],
      }),
    ).rejects.toThrow("Unexpected API response format.");
  });
});
