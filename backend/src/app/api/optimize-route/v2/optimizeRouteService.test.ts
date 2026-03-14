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

  it("prefers the next available visit before far-future windows when no fixed risk is introduced", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Address A", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Address B", coords: { lat: 43.6005, lon: -79.6005 } },
      { address: "Address C", coords: { lat: 43.601, lon: -79.601 } },
      { address: "Address D", coords: { lat: 43.7015, lon: -79.7015 } },
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
            visitId: "visit-c",
            patientId: "patient-c",
            patientName: "Patient C",
            address: "Address C",
            windowStart: "11:00",
            windowEnd: "12:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Patient A",
            address: "Address A",
            windowStart: "09:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-d",
            patientId: "patient-d",
            patientName: "Patient D",
            address: "Address D",
            windowStart: "13:00",
            windowEnd: "15:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b",
            patientId: "patient-b",
            patientName: "Patient B",
            address: "Address B",
            windowStart: "08:00",
            windowEnd: "08:30",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    expect(passedOrderedStops.map((stop) => stop.address)).toEqual([
      "Address B",
      "Address A",
      "Address C",
      "Address D",
      "End",
    ]);
  });

  it("breaks equal-urgency ties by earliest achievable service start (then distance)", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Far Address", coords: { lat: 43.75, lon: -79.75 } },
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
            visitId: "visit-far",
            patientId: "patient-far",
            patientName: "Far Patient",
            address: "Far Address",
            windowStart: "07:00",
            windowEnd: "12:00",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-near",
            patientId: "patient-near",
            patientName: "Near Patient",
            address: "Near Address",
            windowStart: "07:00",
            windowEnd: "12:00",
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
      "Near Address",
      "Far Address",
      "End",
    ]);
  });

  it("uses service duration to prioritize tighter visits", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Long Duration", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Short Duration", coords: { lat: 43.7, lon: -79.7 } },
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
            visitId: "visit-long",
            patientId: "patient-long",
            patientName: "Long Visit",
            address: "Long Duration",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "fixed",
            serviceDurationMinutes: 60,
          },
          {
            visitId: "visit-short",
            patientId: "patient-short",
            patientName: "Short Visit",
            address: "Short Duration",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    expect(passedOrderedStops.map((stop) => stop.address)).toEqual([
      "Long Duration",
      "Short Duration",
      "End",
    ]);
  });

  it("breaks equal-distance ties by earlier window end, then visitId", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Address Z", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Address A", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Address M", coords: { lat: 43.7, lon: -79.7 } },
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
            visitId: "visit-z",
            patientId: "patient-z",
            patientName: "Patient Z",
            address: "Address Z",
            windowStart: "10:00",
            windowEnd: "10:30",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Patient A",
            address: "Address A",
            windowStart: "10:00",
            windowEnd: "10:30",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-m",
            patientId: "patient-m",
            patientName: "Patient M",
            address: "Address M",
            windowStart: "10:00",
            windowEnd: "10:20",
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
      "Address M",
      "Address A",
      "Address Z",
      "End",
    ]);
  });

  it("fills long idle gaps with a feasible nearby visit before returning to a later fixed window", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Shared Fixed Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Nearby Gap Visit", coords: { lat: 43.705, lon: -79.705 } },
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
            visitId: "fixed-am",
            patientId: "patient-fixed-am",
            patientName: "Fixed AM",
            address: "Shared Fixed Address",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "fixed-late-morning",
            patientId: "patient-fixed-late",
            patientName: "Fixed Late Morning",
            address: "Shared Fixed Address",
            windowStart: "10:30",
            windowEnd: "11:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "flex-gap",
            patientId: "patient-gap",
            patientName: "Gap Filler",
            address: "Nearby Gap Visit",
            windowStart: "08:30",
            windowEnd: "10:30",
            windowType: "flexible",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    expect(passedOrderedStops.map((stop) => stop.address)).toEqual([
      "Shared Fixed Address",
      "Nearby Gap Visit",
      "Shared Fixed Address",
      "End",
    ]);
  });

  it("throws when geocoding returns fewer targets than required", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
    ]);

    await expect(
      optimizeRouteV2(
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
              visitId: "visit-1",
              patientId: "patient-1",
              patientName: "Patient One",
              address: "Address One",
              windowStart: "08:00",
              windowEnd: "09:00",
              windowType: "fixed",
              serviceDurationMinutes: 15,
            },
          ],
        },
        "google-key",
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: "Route geocoding data is incomplete.",
    });
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

    expect(result.algorithmVersion).toBe("v2.2.2-window-distance-duration-gap-fill");
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

  it("keeps fixed-window visits scheduled even when the selected departure makes them late", async () => {
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
            windowEnd: "07:36",
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

    expect(result.unscheduledTasks).toEqual([]);
    expect(result.metrics.fixedWindowViolations).toBe(1);
    expect(result.orderedStops[0].tasks.map((task) => task.visitId)).toEqual(["fixed-impossible"]);
    expect(result.orderedStops[1].tasks.map((task) => task.visitId)).toEqual(["flex-ok"]);
  });
});
