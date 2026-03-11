import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./routePlannerService", () => ({
  requestOptimizedRoute: vi.fn(),
}));

import { requestOptimizedRoute } from "./routePlannerService";
import { useRouteOptimization } from "./useRouteOptimization";

const mockedRequestOptimizedRoute = vi.mocked(requestOptimizedRoute);

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
        destinationAddresses: [],
        canOptimize: false,
      });
    });

    expect(result.current.hasAttemptedOptimize).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockedRequestOptimizedRoute).not.toHaveBeenCalled();
  });

  it("stores result and toggles success state on successful optimization", async () => {
    vi.useFakeTimers();
    const payload = {
      start: { address: "Start", coords: { lat: 43.1, lon: -79.1 } },
      end: { address: "End", coords: { lat: 43.2, lon: -79.2 } },
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 1000,
      totalDistanceKm: 1,
      totalDurationSeconds: 120,
    };
    mockedRequestOptimizedRoute.mockResolvedValue(payload);

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinationAddresses: ["A"],
        canOptimize: true,
      });
    });

    expect(result.current.result).toEqual(payload);
    expect(result.current.error).toBe("");
    expect(result.current.showOptimizeSuccess).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });

    expect(result.current.showOptimizeSuccess).toBe(false);
  });

  it("stores Error message when optimize request fails with Error", async () => {
    mockedRequestOptimizedRoute.mockRejectedValue(new Error("Backend failed"));

    const { result } = renderHook(() => useRouteOptimization());

    await act(async () => {
      await result.current.optimizeRoute({
        startAddress: "Start",
        endAddress: "End",
        destinationAddresses: [],
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
        destinationAddresses: [],
        canOptimize: true,
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Something went wrong.");
    });
  });
});
