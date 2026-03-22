import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OptimizeRouteResponse } from "../../components/types";
import { useManualReorder } from "../../components/hooks/useManualReorder";

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
    // secondResult has the same orderedStops order as firstResult [stop-1, stop-2].
    // The manual order applied to firstResult is [stop-2, stop-1] — the reverse.
    // After the result changes and the useEffect reset fires, orderedStops must
    // reflect secondResult's own order [stop-1, stop-2], NOT the stale manual order.
    // If the reset were skipped, applyManualOrder would still produce [stop-2, stop-1],
    // so the assertion on orderedStops[0] would correctly catch that regression.
    const secondResult = buildResult({ algorithmVersion: "v2.5.1-edf-tier/v2" });

    const { result, rerender } = renderHook(({ routeResult }) => useManualReorder(routeResult), {
      initialProps: { routeResult: firstResult as OptimizeRouteResponse | null },
    });

    // Apply manual order [stop-2, stop-1] — inverse of secondResult's native order
    act(() => {
      result.current.moveStop("stop-2", "up");
    });
    expect(result.current.isStale).toBe(true);
    expect(result.current.orderedStops[0]?.stopId).toBe("stop-2");

    rerender({ routeResult: secondResult });

    expect(result.current.isStale).toBe(false);
    expect(result.current.manualOrder).toBeNull();
    // Must reflect secondResult's own order, not the previous manual order
    expect(result.current.orderedStops[0]?.stopId).toBe("stop-1");
    expect(result.current.orderedStops[1]?.stopId).toBe("stop-2");
  });

  it("estimates sequential task times for a stop with multiple tasks", () => {
    const result = buildResult({
      orderedStops: [
        {
          stopId: "stop-multi",
          address: "Multi Task Stop",
          coords: { lat: 43.65, lon: -79.65 },
          arrivalTime: "2026-03-21T08:20:00-04:00",
          departureTime: "2026-03-21T09:20:00-04:00",
          tasks: [
            {
              visitId: "visit-1",
              patientId: "patient-1",
              patientName: "Alex",
              address: "Multi Task Stop",
              windowStart: "08:30",
              windowEnd: "10:00",
              windowType: "fixed",
              serviceDurationMinutes: 20,
              arrivalTime: "2026-03-21T08:20:00-04:00",
              serviceStartTime: "2026-03-21T08:30:00-04:00",
              serviceEndTime: "2026-03-21T08:50:00-04:00",
              waitSeconds: 600,
              lateBySeconds: 0,
              onTime: true,
            },
            {
              visitId: "visit-2",
              patientId: "patient-2",
              patientName: "Jamie",
              address: "Multi Task Stop",
              windowStart: "",
              windowEnd: "",
              windowType: "flexible",
              serviceDurationMinutes: 30,
              arrivalTime: "2026-03-21T08:50:00-04:00",
              serviceStartTime: "2026-03-21T08:50:00-04:00",
              serviceEndTime: "2026-03-21T09:20:00-04:00",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 5,
          durationFromPreviousSeconds: 1200,
        },
        {
          stopId: "stop-after",
          address: "After Stop",
          coords: { lat: 43.7, lon: -79.7 },
          arrivalTime: "2026-03-21T09:35:00-04:00",
          departureTime: "2026-03-21T10:05:00-04:00",
          tasks: [
            {
              visitId: "visit-3",
              patientId: "patient-3",
              patientName: "Sam",
              address: "After Stop",
              windowStart: "09:30",
              windowEnd: "11:00",
              windowType: "fixed",
              serviceDurationMinutes: 30,
              arrivalTime: "2026-03-21T09:35:00-04:00",
              serviceStartTime: "2026-03-21T09:35:00-04:00",
              serviceEndTime: "2026-03-21T10:05:00-04:00",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 3,
          durationFromPreviousSeconds: 900,
        },
        {
          stopId: "stop-end",
          address: "End",
          coords: { lat: 43.72, lon: -79.72 },
          arrivalTime: "2026-03-21T10:30:00-04:00",
          departureTime: "2026-03-21T10:30:00-04:00",
          tasks: [],
          distanceFromPreviousKm: 2.5,
          durationFromPreviousSeconds: 900,
          isEndingPoint: true,
        },
      ],
    });

    const { result: hookResult } = renderHook(() => useManualReorder(result));

    // Trigger a reorder so estimateStops runs
    act(() => {
      hookResult.current.moveStop("stop-after", "up");
    });

    // After reorder: [stop-after, stop-multi, stop-end]
    // stop-multi is now the second stop; stop-end follows it.
    const multiStop = hookResult.current.orderedStops.find((s) => s.stopId === "stop-multi");
    expect(multiStop).toBeDefined();

    const [task1, task2] = multiStop!.tasks;
    expect(task1).toBeDefined();
    expect(task2).toBeDefined();

    const task1EndMs = new Date(task1!.serviceEndTime).getTime();
    const task2StartMs = new Date(task2!.serviceStartTime).getTime();
    const task2EndMs = new Date(task2!.serviceEndTime).getTime();

    // Second task starts no earlier than where the first ended
    expect(task2StartMs).toBeGreaterThanOrEqual(task1EndMs);
    // Second task ends after it starts (30 min duration)
    expect(task2EndMs - task2StartMs).toBe(30 * 60_000);

    // stop-end follows stop-multi and must arrive after stop-multi's last task ends,
    // confirming the cursor advanced through both tasks before computing stop-end's arrival
    const stopEnd = hookResult.current.orderedStops.find((s) => s.stopId === "stop-end");
    expect(stopEnd).toBeDefined();
    const stopEndArrivalMs = new Date(stopEnd!.arrivalTime).getTime();
    expect(stopEndArrivalMs).toBeGreaterThan(task2EndMs);
  });

  it("advances cursor past a no-coords stop so subsequent arrival times are later", () => {
    // Setup: [stop-1 (coords), stop-no-coords (no coords, 600s leg), stop-3 (coords), stop-end (coords)]
    // After moving stop-3 up: [stop-1, stop-3, stop-no-coords, stop-end]
    // estimateStops: stop-3 is estimated, cursor = stop-3 departure.
    // stop-no-coords: no coords, cursor += 600s, returns original stop.
    // stop-end: arrival = cursor (stop-3 departure + 600s) + haversine travel.
    // If the cursor advance were missing, stop-end would arrive
    // haversine-travel-only past stop-3's departure — less than 600s — and the
    // assertion below would fail.
    const NO_COORDS_DURATION_S = 600;
    const result = buildResult({
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
          stopId: "stop-no-coords",
          address: "Unknown Location",
          coords: { lat: NaN, lon: NaN },
          arrivalTime: "2026-03-21T09:00:00-04:00",
          departureTime: "2026-03-21T09:10:00-04:00",
          tasks: [
            {
              visitId: "visit-2",
              patientId: "patient-2",
              patientName: "Jamie",
              address: "Unknown Location",
              windowStart: "09:00",
              windowEnd: "10:00",
              windowType: "fixed",
              serviceDurationMinutes: 10,
              arrivalTime: "2026-03-21T09:00:00-04:00",
              serviceStartTime: "2026-03-21T09:00:00-04:00",
              serviceEndTime: "2026-03-21T09:10:00-04:00",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 3,
          durationFromPreviousSeconds: NO_COORDS_DURATION_S,
        },
        {
          stopId: "stop-3",
          address: "Stop Three",
          coords: { lat: 43.7, lon: -79.7 },
          arrivalTime: "2026-03-21T09:20:00-04:00",
          departureTime: "2026-03-21T09:50:00-04:00",
          tasks: [
            {
              visitId: "visit-3",
              patientId: "patient-3",
              patientName: "Sam",
              address: "Stop Three",
              windowStart: "09:20",
              windowEnd: "11:00",
              windowType: "fixed",
              serviceDurationMinutes: 30,
              arrivalTime: "2026-03-21T09:20:00-04:00",
              serviceStartTime: "2026-03-21T09:20:00-04:00",
              serviceEndTime: "2026-03-21T09:50:00-04:00",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 600,
        },
        {
          stopId: "stop-end",
          address: "End",
          coords: { lat: 43.72, lon: -79.72 },
          arrivalTime: "2026-03-21T10:10:00-04:00",
          departureTime: "2026-03-21T10:10:00-04:00",
          tasks: [],
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
    });

    const { result: hookResult } = renderHook(() => useManualReorder(result));

    // Move stop-3 past stop-no-coords: order becomes [stop-1, stop-3, stop-no-coords, stop-end]
    act(() => {
      hookResult.current.moveStop("stop-3", "up");
    });

    const stop3 = hookResult.current.orderedStops.find((s) => s.stopId === "stop-3");
    const stopEnd = hookResult.current.orderedStops.find((s) => s.stopId === "stop-end");

    expect(stop3).toBeDefined();
    expect(stopEnd).toBeDefined();

    const stop3DepartureMs = new Date(stop3!.departureTime).getTime();
    const stopEndArrivalMs = new Date(stopEnd!.arrivalTime).getTime();

    // stop-end's arrival must be at least NO_COORDS_DURATION_S past stop-3's departure.
    // Haversine travel from stop-3 (43.7,-79.7) to stop-end (43.72,-79.72) at 40km/h
    // is ~250s, which is well under 600s. Without the cursor advance, stop-end would
    // arrive only ~250s past stop-3 departure and this assertion would fail.
    expect(stopEndArrivalMs).toBeGreaterThanOrEqual(stop3DepartureMs + NO_COORDS_DURATION_S * 1000);
  });
});
