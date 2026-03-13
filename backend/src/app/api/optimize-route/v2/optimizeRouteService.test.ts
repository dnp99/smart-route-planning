import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../geocoding", () => ({
  geocodeTargetsSequentially: vi.fn(),
  normalizeAddressKey: (address: string) => address.trim().toLowerCase(),
}));

vi.mock("../routing", () => ({
  buildDrivingRoute: vi.fn(),
}));

import { geocodeTargetsSequentially } from "../geocoding";
import { buildDrivingRoute } from "../routing";
import { optimizeRouteV2 } from "./optimizeRouteService";

const mockedGeocodeTargetsSequentially = vi.mocked(geocodeTargetsSequentially);
const mockedBuildDrivingRoute = vi.mocked(buildDrivingRoute);

const buildDrivingRouteResult = (addresses: string[]) => ({
  orderedStops: addresses.map((address, index) => ({
    address,
    coords: { lat: index + 1, lon: index + 1 },
    distanceFromPreviousKm: 1,
    durationFromPreviousSeconds: 600,
    isEndingPoint: index === addresses.length - 1,
  })),
  routeLegs: addresses.map((toAddress, index) => ({
    fromAddress: index === 0 ? "Start" : addresses[index - 1],
    toAddress,
    distanceMeters: 1000,
    durationSeconds: 600,
    encodedPolyline: "abc",
  })),
  totalDistanceMeters: addresses.length * 1000,
  totalDistanceKm: addresses.length,
  totalDurationSeconds: addresses.length * 600,
});

describe("optimizeRouteV2 service", () => {
  beforeEach(() => {
    mockedGeocodeTargetsSequentially.mockReset();
    mockedBuildDrivingRoute.mockReset();
  });

  it("prioritizes fixed-window visits before flexible visits", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Far Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Near Address", coords: { lat: 43.6005, lon: -79.6005 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "flex-1",
            patientId: "patient-flex",
            patientName: "Flexible Patient",
            address: "Near Address",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "fixed-1",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Far Address",
            windowStart: "08:00",
            windowEnd: "08:30",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    expect(passedOrderedStops.map((stop) => stop.address)).toEqual([
      "Far Address",
      "Near Address",
      "End",
    ]);
  });

  it("groups consecutive same-location visits into one stop and returns metrics", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Shared Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockResolvedValue(
      buildDrivingRouteResult(["Shared Address", "End"]),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "fixed-am",
            patientId: "patient-1",
            patientName: "Yasmin Ramji",
            address: "Shared Address",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "fixed-pm",
            patientId: "patient-2",
            patientName: "Hassan Ramji",
            address: "Shared Address",
            windowStart: "09:30",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    expect(result.algorithmVersion).toBe("v2.1.0-greedy-window-first");
    expect(result.orderedStops).toHaveLength(2);
    expect(result.orderedStops[0].tasks).toHaveLength(2);
    expect(result.orderedStops[0].tasks[0].visitId).toBe("fixed-am");
    expect(result.orderedStops[0].tasks[1].visitId).toBe("fixed-pm");
    expect(result.orderedStops[1].isEndingPoint).toBe(true);
    expect(result.routeLegs[0]).toMatchObject({
      fromStopId: "start",
      toStopId: "stop-1",
    });
    expect(result.metrics.totalDistanceMeters).toBe(2000);
    expect(result.unscheduledTasks).toEqual([]);
  });

  it("unschedules unreachable fixed-window visits and keeps remaining route schedulable", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Far Fixed Address", coords: { lat: 43.8, lon: -79.8 } },
      { address: "Flexible Address", coords: { lat: 43.6003, lon: -79.6003 } },
      { address: "End", coords: { lat: 43.61, lon: -79.61 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "fixed-impossible",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Far Fixed Address",
            windowStart: "07:35",
            windowEnd: "07:40",
            windowType: "fixed",
            serviceDurationMinutes: 5,
          },
          {
            visitId: "flex-ok",
            patientId: "patient-flex",
            patientName: "Flexible Patient",
            address: "Flexible Address",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "flexible",
            serviceDurationMinutes: 10,
          },
        ],
      },
      "google-key",
    );

    expect(result.unscheduledTasks).toEqual([
      {
        visitId: "fixed-impossible",
        patientId: "patient-fixed",
        reason: "fixed_window_unreachable",
      },
    ]);
    expect(result.metrics.fixedWindowViolations).toBe(1);
    expect(result.orderedStops[0].tasks.map((task) => task.visitId)).toEqual(["flex-ok"]);
  });
});
