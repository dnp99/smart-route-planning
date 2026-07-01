import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouteAdvisor } from "../../features/route-planner/hooks/useRouteAdvisor";
import {
  requestRouteAdvice,
  RouteAdvisorUnavailableError,
} from "../../features/route-planner/api/routePlannerService";
import type { OptimizeRouteResponse } from "../../components/types";

vi.mock("../../features/route-planner/api/routePlannerService", async () => {
  const actual = await vi.importActual<
    typeof import("../../features/route-planner/api/routePlannerService")
  >("../../features/route-planner/api/routePlannerService");
  return { ...actual, requestRouteAdvice: vi.fn() };
});

const mockedRequest = vi.mocked(requestRouteAdvice);

const buildResult = (): OptimizeRouteResponse =>
  ({
    timezone: "America/Toronto",
    start: {
      address: "1 Home Road",
      coords: { lat: 43.7, lon: -79.4 },
      departureTime: "2026-03-25T11:45:00Z",
    },
    end: { address: "1 Home Road", coords: { lat: 43.7, lon: -79.4 } },
    orderedStops: [
      {
        stopId: "stop-1",
        address: "10 First Ave",
        coords: { lat: 43.71, lon: -79.41 },
        arrivalTime: "2026-03-25T12:50:00Z",
        departureTime: "2026-03-25T13:20:00Z",
        distanceFromPreviousKm: 5,
        durationFromPreviousSeconds: 1200,
        isEndingPoint: false,
        tasks: [
          {
            visitId: "visit-1",
            patientId: "patient-1",
            patientName: "Alex Johnson",
            address: "10 First Ave",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
            arrivalTime: "2026-03-25T12:50:00Z",
            serviceStartTime: "2026-03-25T13:00:00Z",
            serviceEndTime: "2026-03-25T13:30:00Z",
            waitSeconds: 0,
            lateBySeconds: 0,
            onTime: true,
          },
        ],
      },
    ],
    routeLegs: [],
    unscheduledTasks: [],
    warnings: [],
    metrics: {
      fixedWindowViolations: 0,
      totalLateSeconds: 0,
      totalWaitSeconds: 0,
      totalDistanceMeters: 8000,
      totalDistanceKm: 8,
      totalDurationSeconds: 2100,
    },
    algorithmVersion: "v3",
  }) as OptimizeRouteResponse;

describe("useRouteAdvisor", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("caches advice for an identical route — a second request hits no network", async () => {
    mockedRequest.mockResolvedValue({ brief: "Looks clean.", suggestions: [] });
    const result = buildResult();
    const { result: hook } = renderHook(() => useRouteAdvisor(result));

    await act(async () => {
      await hook.current.requestAdvice(result, "2026-03-25");
    });
    await waitFor(() => expect(hook.current.advice?.brief).toBe("Looks clean."));

    await act(async () => {
      await hook.current.requestAdvice(result, "2026-03-25");
    });

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(hook.current.advice?.brief).toBe("Looks clean.");
  });

  it("marks the advisor unavailable on a 503 without surfacing an error", async () => {
    mockedRequest.mockRejectedValue(new RouteAdvisorUnavailableError());
    const result = buildResult();
    const { result: hook } = renderHook(() => useRouteAdvisor(result));

    await act(async () => {
      await hook.current.requestAdvice(result, "2026-03-25");
    });

    await waitFor(() => expect(hook.current.adviceUnavailable).toBe(true));
    expect(hook.current.adviceError).toBe("");
    expect(hook.current.advice).toBeNull();
  });
});
