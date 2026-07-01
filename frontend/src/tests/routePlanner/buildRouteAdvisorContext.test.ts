import { describe, expect, it } from "vitest";
import { buildRouteAdvisorContext } from "../../features/route-planner/domain/buildRouteAdvisorContext";
import type { OptimizeRouteResponse } from "../../components/types";

const buildResult = (overrides: Partial<OptimizeRouteResponse> = {}): OptimizeRouteResponse =>
  ({
    timezone: "America/Toronto",
    start: {
      address: "1 Nurse Home Road",
      coords: { lat: 43.7, lon: -79.4 },
      departureTime: "2026-03-25T11:45:00Z",
    },
    end: { address: "1 Nurse Home Road", coords: { lat: 43.7, lon: -79.4 } },
    orderedStops: [
      {
        stopId: "stop-1",
        address: "10 Secret Street",
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
            address: "10 Secret Street",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
            arrivalTime: "2026-03-25T12:50:00Z",
            serviceStartTime: "2026-03-25T13:00:00Z",
            serviceEndTime: "2026-03-25T13:30:00Z",
            waitSeconds: 0,
            lateBySeconds: 720,
            onTime: false,
          },
        ],
      },
      {
        stopId: "stop-end",
        address: "1 Nurse Home Road",
        coords: { lat: 43.7, lon: -79.4 },
        arrivalTime: "2026-03-25T14:00:00Z",
        departureTime: "2026-03-25T14:00:00Z",
        distanceFromPreviousKm: 3,
        durationFromPreviousSeconds: 900,
        isEndingPoint: true,
        tasks: [],
      },
    ],
    routeLegs: [],
    unscheduledTasks: [],
    warnings: [
      {
        type: "fixed_late",
        patientId: "patient-1",
        patientName: "Alex Johnson",
        lateMinutes: 12,
        message: "Alex Johnson will be served 12 min late.",
      },
    ],
    metrics: {
      fixedWindowViolations: 1,
      totalLateSeconds: 720,
      totalWaitSeconds: 0,
      totalDistanceMeters: 8000,
      totalDistanceKm: 8,
      totalDurationSeconds: 2100,
    },
    algorithmVersion: "v3",
    ...overrides,
  }) as OptimizeRouteResponse;

describe("buildRouteAdvisorContext", () => {
  it("emits no patient names or addresses anywhere in the context (PHI boundary)", () => {
    const context = buildRouteAdvisorContext(buildResult(), "2026-03-25");
    const serialized = JSON.stringify(context);

    expect(serialized).not.toContain("Alex Johnson");
    expect(serialized).not.toContain("Secret Street");
    expect(serialized).not.toContain("Nurse Home Road");
    expect(serialized).not.toContain("patient-1");
    expect(serialized).not.toContain("visit-1");
  });

  it("de-identifies warnings down to type + minute counts", () => {
    const context = buildRouteAdvisorContext(buildResult(), "2026-03-25");

    expect(context.warnings).toEqual([{ type: "fixed_late", lateMinutes: 12 }]);
  });

  it("labels stops by 1-based index with onTime and late minutes", () => {
    const context = buildRouteAdvisorContext(buildResult(), "2026-03-25");

    expect(context.stopCount).toBe(1);
    expect(context.visitCount).toBe(1);
    expect(context.stops).toEqual([
      { index: 1, windowType: "fixed", onTime: false, lateMinutes: 12 },
    ]);
  });

  it("converts metrics seconds to minutes and resolves the weekday", () => {
    const context = buildRouteAdvisorContext(buildResult(), "2026-03-25");

    expect(context.planningWeekday).toBe("Wednesday");
    expect(context.timezone).toBe("America/Toronto");
    expect(context.metrics).toEqual({
      distanceKm: 8,
      durationMinutes: 35,
      lateMinutes: 12,
      waitMinutes: 0,
      fixedWindowViolations: 1,
    });
  });

  it("aggregates unscheduled tasks by reason without ids", () => {
    const context = buildRouteAdvisorContext(
      buildResult({
        unscheduledTasks: [
          { visitId: "v-a", patientId: "p-a", reason: "invalid_window" },
          { visitId: "v-b", patientId: "p-b", reason: "invalid_window" },
          { visitId: "v-c", patientId: "p-c", reason: "insufficient_day_capacity" },
        ],
      }),
      "2026-03-25",
    );

    expect(context.unscheduledByReason).toEqual({
      invalid_window: 2,
      insufficient_day_capacity: 1,
    });
  });
});
