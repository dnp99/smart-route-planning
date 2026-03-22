import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/routePlanner/routePlannerService", () => ({
  requestOptimizedRoute: vi.fn(),
}));

import { requestOptimizedRoute } from "../../components/routePlanner/routePlannerService";
import { useRouteOptimization } from "../../components/hooks/useRouteOptimization";

const mockedRequestOptimizedRoute = vi.mocked(requestOptimizedRoute);
const buildResponse = () => ({
  start: {
    address: "Start",
    coords: { lat: 43.1, lon: -79.1 },
    departureTime: "2026-03-13T07:30:00-04:00",
  },
  end: { address: "End", coords: { lat: 43.2, lon: -79.2 } },
  orderedStops: [],
  routeLegs: [],
  unscheduledTasks: [],
  metrics: {
    fixedWindowViolations: 0,
    totalLateSeconds: 0,
    totalWaitSeconds: 0,
    totalDistanceMeters: 1000,
    totalDistanceKm: 1,
    totalDurationSeconds: 120,
  },
  algorithmVersion: "v2.1.0-greedy-window-first",
});

describe("useRouteOptimization", () => {
  beforeEach(() => {
    mockedRequestOptimizedRoute.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks attempt and skips API call when canOptimize is false", async () => {
    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "",
        endAddress: "",
        destinations: [],
        canOptimize: false,
      });
    });

    expect(result.current.hasAttemptedOptimize).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockedRequestOptimizedRoute).not.toHaveBeenCalled();
  });

  it("stores result and toggles success state on successful optimization", async () => {
    vi.useFakeTimers();
    const payload = buildResponse();
    mockedRequestOptimizedRoute.mockResolvedValue(payload);

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [
          {
            address: "A",
            patientId: "patient-1",
            patientName: "Jane Doe",
            googlePlaceId: null,
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
          },
        ],
        canOptimize: true,
      });
    });

    expect(result.current.result).toEqual(payload);
    expect(result.current.error).toBe("");
    expect(result.current.showOptimizeSuccess).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockedRequestOptimizedRoute).toHaveBeenCalledWith({
      startAddress: "Start",
      endAddress: "End",
      destinations: [
        {
          address: "A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          googlePlaceId: null,
          windowStart: "09:00",
          windowEnd: "09:30",
          windowType: "fixed",
        },
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });

    expect(result.current.showOptimizeSuccess).toBe(false);
  });

  it("forwards manual start and end place ids when provided", async () => {
    mockedRequestOptimizedRoute.mockResolvedValue(buildResponse());

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        startGooglePlaceId: "start-place",
        endAddress: "End",
        endGooglePlaceId: "end-place",
        destinations: [],
        canOptimize: true,
      });
    });

    expect(mockedRequestOptimizedRoute).toHaveBeenCalledWith({
      startAddress: "Start",
      startGooglePlaceId: "start-place",
      endAddress: "End",
      endGooglePlaceId: "end-place",
      destinations: [],
    });
  });

  it("forwards preserveOrder when requested", async () => {
    mockedRequestOptimizedRoute.mockResolvedValue(buildResponse());

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
        canOptimize: true,
        preserveOrder: true,
      });
    });

    expect(mockedRequestOptimizedRoute).toHaveBeenCalledWith({
      startAddress: "Start",
      endAddress: "End",
      destinations: [],
      preserveOrder: true,
    });
  });

  it("stores Error message when optimize request fails with Error", async () => {
    mockedRequestOptimizedRoute.mockRejectedValue(new Error("Backend failed"));

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
        canOptimize: true,
      });
    });

    expect(result.current.error).toBe("Backend failed");
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("stores fallback message when optimize request fails with non-Error", async () => {
    mockedRequestOptimizedRoute.mockRejectedValue("oops");

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
        canOptimize: true,
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Something went wrong.");
    });
  });
});
