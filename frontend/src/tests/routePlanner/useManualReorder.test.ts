import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OptimizeRouteResponse } from "../../components/types";
import { useManualReorder } from "../../components/routePlanner/useManualReorder";

const buildResult = (overrides: Partial<OptimizeRouteResponse> = {}): OptimizeRouteResponse => ({
  start: {
    address: "Start",
    coords: { lat: 43.6, lon: -79.6 },
    departureTime: "2026-03-21T08:00:00-04:00",
  },
  end: {
    address: "End",
    coords: { lat: 43.72, lon: -79.72 },
  },
  orderedStops: [
    {
      stopId: "stop-1",
      address: "Stop One",
      coords: { lat: 43.65, lon: -79.65 },
      arrivalTime: "2026-03-21T08:20:00-04:00",
      departureTime: "2026-03-21T08:50:00-04:00",
      tasks: [
        {
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "Alex",
          address: "Stop One",
          windowStart: "08:30",
          windowEnd: "09:30",
          windowType: "fixed",
          serviceDurationMinutes: 30,
          arrivalTime: "2026-03-21T08:20:00-04:00",
          serviceStartTime: "2026-03-21T08:30:00-04:00",
          serviceEndTime: "2026-03-21T09:00:00-04:00",
          waitSeconds: 600,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
      distanceFromPreviousKm: 5,
      durationFromPreviousSeconds: 1200,
    },
    {
      stopId: "stop-2",
      address: "Stop Two",
      coords: { lat: 43.7, lon: -79.7 },
      arrivalTime: "2026-03-21T09:15:00-04:00",
      departureTime: "2026-03-21T09:45:00-04:00",
      tasks: [
        {
          visitId: "visit-2",
          patientId: "patient-2",
          patientName: "Jamie",
          address: "Stop Two",
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
          arrivalTime: "2026-03-21T09:15:00-04:00",
          serviceStartTime: "2026-03-21T09:15:00-04:00",
          serviceEndTime: "2026-03-21T09:45:00-04:00",
          waitSeconds: 0,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
      distanceFromPreviousKm: 3.2,
      durationFromPreviousSeconds: 900,
    },
    {
      stopId: "stop-end",
      address: "End",
      coords: { lat: 43.72, lon: -79.72 },
      arrivalTime: "2026-03-21T10:00:00-04:00",
      departureTime: "2026-03-21T10:00:00-04:00",
      tasks: [],
      distanceFromPreviousKm: 2.5,
      durationFromPreviousSeconds: 900,
      isEndingPoint: true,
    },
  ],
  routeLegs: [],
  unscheduledTasks: [],
  metrics: {
    fixedWindowViolations: 0,
    totalLateSeconds: 0,
    totalWaitSeconds: 0,
    totalDistanceMeters: 10_700,
    totalDistanceKm: 10.7,
    totalDurationSeconds: 3_000,
  },
  algorithmVersion: "v2.5.1-edf-tier",
  ...overrides,
});

describe("useManualReorder", () => {
  it("moves stops up and down and marks timeline as stale", () => {
    const routeResult = buildResult();
    const { result } = renderHook(() => useManualReorder(routeResult));

    expect(result.current.isStale).toBe(false);
    expect(result.current.orderedStops[0]?.stopId).toBe("stop-1");
    expect(result.current.canMoveStop("stop-1", "up")).toBe(false);
    expect(result.current.canMoveStop("stop-1", "down")).toBe(true);

    act(() => {
      result.current.moveStop("stop-2", "up");
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.orderedStops[0]?.stopId).toBe("stop-2");
    expect(result.current.orderedStops[1]?.stopId).toBe("stop-1");
    expect(result.current.orderedStops[0]?.tasks[0]?.serviceStartTime).not.toBe(
      "2026-03-21T09:15:00-04:00",
    );
  });

  it("resets order and stale state", () => {
    const routeResult = buildResult();
    const { result } = renderHook(() => useManualReorder(routeResult));

    act(() => {
      result.current.moveStop("stop-2", "up");
    });
    expect(result.current.isStale).toBe(true);

    act(() => {
      result.current.resetOrder();
    });

    expect(result.current.isStale).toBe(false);
    expect(result.current.manualOrder).toBeNull();
    expect(result.current.orderedStops.map((stop) => stop.stopId)).toEqual([
      "stop-1",
      "stop-2",
      "stop-end",
    ]);
  });

  it("clears manual order when optimization result changes", () => {
    const firstResult = buildResult();
    const secondResult = buildResult({
      algorithmVersion: "v2.5.1-edf-tier/preserved",
    });
    const { result, rerender } = renderHook(
      ({ routeResult }) => useManualReorder(routeResult),
      {
        initialProps: { routeResult: firstResult as OptimizeRouteResponse | null },
      },
    );

    act(() => {
      result.current.moveStop("stop-2", "up");
    });
    expect(result.current.isStale).toBe(true);

    rerender({ routeResult: secondResult });

    expect(result.current.isStale).toBe(false);
    expect(result.current.manualOrder).toBeNull();
    expect(result.current.orderedStops[0]?.stopId).toBe("stop-1");
  });
});
