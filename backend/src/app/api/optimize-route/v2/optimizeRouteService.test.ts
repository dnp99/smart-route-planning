import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../geocoding", () => ({
  geocodeTargetsSequentially: vi.fn(),
  normalizeAddressKey: (address: string) => address.trim().toLowerCase(),
}));

vi.mock("../routing", () => ({
  buildDrivingRoute: vi.fn(),
}));

vi.mock("./travelMatrix", () => ({
  buildPlanningTravelDurationMatrix: vi.fn(),
}));

import { geocodeTargetsSequentially } from "../geocoding";
import { buildDrivingRoute } from "../routing";
import { buildPlanningTravelDurationMatrix } from "./travelMatrix";
import { optimizeRouteV2 } from "./optimizeRouteService";

const mockedGeocodeTargetsSequentially = vi.mocked(geocodeTargetsSequentially);
const mockedBuildDrivingRoute = vi.mocked(buildDrivingRoute);
const mockedBuildPlanningTravelDurationMatrix = vi.mocked(buildPlanningTravelDurationMatrix);

const buildTravelMatrix = (
  entries: Array<[fromKey: string, toKey: string, durationSeconds: number]>,
) => {
  const matrix = new Map<string, Map<string, number>>();

  entries.forEach(([from, to, duration]) => {
    const existing = matrix.get(from) ?? new Map<string, number>();
    existing.set(to, duration);
    matrix.set(from, existing);
  });

  return matrix;
};

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
    mockedBuildPlanningTravelDurationMatrix.mockReset();
    mockedBuildPlanningTravelDurationMatrix.mockRejectedValue(new Error("matrix unavailable"));
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

  it("uses planning travel matrix durations for ranking when matrix acquisition succeeds", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Address A", coords: { lat: 43.6001, lon: -79.6001 } },
      { address: "Address B", coords: { lat: 43.71, lon: -79.71 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:address a", 1600],
        ["address:start", "address:address b", 300],
        ["address:address a", "address:address b", 300],
        ["address:address b", "address:address a", 300],
      ]),
    );

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
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Patient A",
            address: "Address A",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b",
            patientId: "patient-b",
            patientName: "Patient B",
            address: "Address B",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
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
      "End",
    ]);
  });

  it("falls back to estimated travel ranking when planning matrix acquisition fails", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Near Address", coords: { lat: 43.6003, lon: -79.6003 } },
      { address: "Far Address", coords: { lat: 43.75, lon: -79.75 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockRejectedValue(new Error("matrix unavailable"));
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
            visitId: "visit-near",
            patientId: "patient-near",
            patientName: "Near Patient",
            address: "Near Address",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-far",
            patientId: "patient-far",
            patientName: "Far Patient",
            address: "Far Address",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
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

  it("computes departure time from earliest-window first stop travel plus 10-minute buffer", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Earliest Visit", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Later Visit", coords: { lat: 43.61, lon: -79.61 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute
      .mockResolvedValueOnce({
        orderedStops: [
          {
            address: "Earliest Visit",
            coords: { lat: 43.7, lon: -79.7 },
            distanceFromPreviousKm: 2.5,
            durationFromPreviousSeconds: 900,
          },
        ],
        routeLegs: [
          {
            fromAddress: "Start",
            toAddress: "Earliest Visit",
            distanceMeters: 2500,
            durationSeconds: 900,
            encodedPolyline: "abc",
          },
        ],
        totalDistanceMeters: 2500,
        totalDistanceKm: 2.5,
        totalDurationSeconds: 900,
      })
      .mockImplementationOnce(async (_, orderedStops) =>
        buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
      );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-early",
            patientId: "patient-early",
            patientName: "Early Patient",
            address: "Earliest Visit",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-late",
            patientId: "patient-late",
            patientName: "Late Patient",
            address: "Later Visit",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    expect(mockedBuildDrivingRoute).toHaveBeenCalledTimes(2);
    const firstCallStops = mockedBuildDrivingRoute.mock.calls[0]?.[1] ?? [];
    expect(firstCallStops.map((stop) => stop.address)).toEqual(["Earliest Visit"]);

    expect(result.start.departureTime).toBe("2026-03-13T08:05:00.000Z");
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

    mockedBuildDrivingRoute.mockResolvedValue(buildDrivingRouteResult(["Shared Address", "End"]));

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

    expect(result.algorithmVersion).toBe("v2.5.1-edf-tier");
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

  it("preserves input visit order when preserveOrder is true", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Address A", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Address B", coords: { lat: 43.6005, lon: -79.6005 } },
      { address: "Address C", coords: { lat: 43.601, lon: -79.601 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
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
        preserveOrder: true,
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

    expect(result.unscheduledTasks).toEqual([]);
    expect(result.algorithmVersion).toBe("v2.5.1-edf-tier/preserved");
    expect(result.orderedStops.map((stop) => stop.tasks[0]?.visitId)).toEqual([
      "visit-c",
      "visit-a",
      "visit-b",
      undefined,
    ]);
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

  it("emits unscheduledTasks for flexible visits that exceed day capacity", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Address", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Flexible Address", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T23:40:00.000Z",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "fixed-late",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Fixed Address",
            windowStart: "22:00",
            windowEnd: "23:45",
            windowType: "fixed",
            serviceDurationMinutes: 10,
          },
          {
            visitId: "flex-overflow",
            patientId: "patient-flex",
            patientName: "Flexible Overflow",
            address: "Flexible Address",
            windowStart: "20:00",
            windowEnd: "23:59",
            windowType: "flexible",
            serviceDurationMinutes: 45,
          },
        ],
      },
      "google-key",
    );

    expect(result.unscheduledTasks).toEqual([
      {
        visitId: "flex-overflow",
        patientId: "patient-flex",
        reason: "insufficient_day_capacity",
      },
    ]);
    expect(result.orderedStops.flatMap((stop) => stop.tasks.map((task) => task.visitId))).toEqual([
      "fixed-late",
    ]);
    expect(result.metrics.fixedWindowViolations).toBe(1);
  });

  it("does not append a duplicate ending stop when last visit location matches end location", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Shared Address", coords: { lat: 43.7, lon: -79.7 } },
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
          address: "Shared Address",
        },
        visits: [
          {
            visitId: "visit-1",
            patientId: "patient-1",
            patientName: "Patient One",
            address: "Shared Address",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    expect(result.orderedStops).toHaveLength(1);
    expect(result.orderedStops[0]).toMatchObject({
      address: "Shared Address",
      isEndingPoint: true,
    });
    expect(mockedBuildDrivingRoute).toHaveBeenCalledWith(
      expect.any(Object),
      [expect.objectContaining({ address: "Shared Address", isEndingPoint: true })],
      "google-key",
    );
  });

  it("falls back to estimated travel for dynamic departure when first-leg driving lookup fails", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "First Visit", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute
      .mockRejectedValueOnce(new Error("routes unavailable"))
      .mockImplementationOnce(async (_, orderedStops) =>
        buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
      );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-1",
            patientId: "patient-1",
            patientName: "Patient One",
            address: "First Visit",
            windowStart: "08:30",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    expect(mockedBuildDrivingRoute).toHaveBeenCalledTimes(2);
    expect(result.start.departureTime).not.toBe("2026-03-13T00:00:00.000Z");
  });

  it("auto-schedules flexible visits without preferred windows and defaults unanchored departure to 08:00 local", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Flexible Visit", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-flex-no-window",
            patientId: "patient-flex-no-window",
            patientName: "Flexible No Window",
            address: "Flexible Visit",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    expect(result.start.departureTime).toBe("2026-03-13T08:00:00.000Z");
    expect(result.orderedStops[0]?.tasks[0]).toMatchObject({
      visitId: "visit-flex-no-window",
      windowStart: "",
      windowEnd: "",
      lateBySeconds: 0,
      onTime: true,
      serviceStartTime: "2026-03-13T08:10:00.000Z",
    });
  });

  it("does not count sub-minute fixed lateness as a violation", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Visit", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops: [
        {
          address: "Fixed Visit",
          coords: { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 601,
        },
        {
          address: "End",
          coords: { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: "Fixed Visit",
          distanceMeters: 2000,
          durationSeconds: 601,
          encodedPolyline: "abc",
        },
        {
          fromAddress: "Fixed Visit",
          toAddress: "End",
          distanceMeters: 2000,
          durationSeconds: 600,
          encodedPolyline: "def",
        },
      ],
      totalDistanceMeters: 4000,
      totalDistanceKm: 4,
      totalDurationSeconds: 1201,
    });

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:50:00.000Z",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "fixed-sub-minute",
            patientId: "patient-fixed",
            patientName: "Fixed Sub Minute",
            address: "Fixed Visit",
            windowStart: "07:00",
            windowEnd: "08:00",
            windowType: "fixed",
            serviceDurationMinutes: 10,
          },
        ],
      },
      "google-key",
    );

    const task = result.orderedStops[0]?.tasks[0];
    expect(task?.lateBySeconds).toBe(0);
    expect(task?.onTime).toBe(true);
    expect(result.metrics.fixedWindowViolations).toBe(0);
  });

  it("defaults dynamic departure to planning-date midnight when there are no visits", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
        },
        end: {
          address: "End",
        },
        visits: [],
      },
      "google-key",
    );

    expect(result.start.departureTime).toBe("2026-03-13T00:00:00.000Z");
    expect(result.orderedStops).toHaveLength(1);
    expect(result.orderedStops[0]).toMatchObject({
      address: "End",
      isEndingPoint: true,
      tasks: [],
    });
  });

  it("schedules a fixed-window patient before a closer no-window patient", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Ravi Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Jing Address", coords: { lat: 43.601, lon: -79.601 } },
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
          departureTime: "2026-03-13T08:30:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-ravi",
            patientId: "patient-ravi",
            patientName: "Ravi R",
            address: "Ravi Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-jing",
            patientId: "patient-jing",
            patientName: "Jing Su",
            address: "Jing Address",
            windowStart: "",
            windowEnd: "",
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
      "Ravi Address",
      "Jing Address",
      "End",
    ]);
  });

  it("schedules all fixed-window patients before a closer no-window patient when two share the same window", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Ravi Address", coords: { lat: 43.65, lon: -79.65 } },
      { address: "Deep Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Jing Address", coords: { lat: 43.601, lon: -79.601 } },
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
          departureTime: "2026-03-13T08:30:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-ravi",
            patientId: "patient-ravi",
            patientName: "Ravi R",
            address: "Ravi Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-deep",
            patientId: "patient-deep",
            patientName: "Deep P",
            address: "Deep Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-jing",
            patientId: "patient-jing",
            patientName: "Jing Su",
            address: "Jing Address",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    const stopAddresses = passedOrderedStops.map((stop) => stop.address);
    const jingIndex = stopAddresses.indexOf("Jing Address");
    const raviIndex = stopAddresses.indexOf("Ravi Address");
    const deepIndex = stopAddresses.indexOf("Deep Address");
    expect(jingIndex).toBeGreaterThan(raviIndex);
    expect(jingIndex).toBeGreaterThan(deepIndex);
  });

  it("gap-filler still inserts a no-window patient into a large idle gap before a fixed anchor", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed PM Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Nearby No-Window", coords: { lat: 43.705, lon: -79.705 } },
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
            visitId: "fixed-pm",
            patientId: "patient-fixed",
            patientName: "Fixed PM",
            address: "Fixed PM Address",
            windowStart: "11:00",
            windowEnd: "12:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "no-window",
            patientId: "patient-no-window",
            patientName: "No Window Patient",
            address: "Nearby No-Window",
            windowStart: "",
            windowEnd: "",
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
      "Nearby No-Window",
      "Fixed PM Address",
      "End",
    ]);
  });

  it("emits window_conflict warning for two fixed patients whose windows cannot both be satisfied", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Ravi Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Deep Address", coords: { lat: 43.8, lon: -79.8 } },
      { address: "End", coords: { lat: 43.9, lon: -79.9 } },
    ]);

    // Travel matrix: ~7200s (2h) between patients — cannot serve both within 09:00-10:00 window
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:ravi address", 600],
        ["address:start", "address:deep address", 600],
        ["address:ravi address", "address:deep address", 7200],
        ["address:deep address", "address:ravi address", 7200],
        ["address:ravi address", "address:end", 600],
        ["address:deep address", "address:end", 600],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T08:30:00-04:00",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-ravi",
            patientId: "patient-ravi",
            patientName: "Ravi R",
            address: "Ravi Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-deep",
            patientId: "patient-deep",
            patientName: "Deep P",
            address: "Deep Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const conflictWarning = result.warnings?.find((w) => w.type === "window_conflict");
    expect(conflictWarning).toBeDefined();
    expect(conflictWarning?.type).toBe("window_conflict");
    if (conflictWarning?.type === "window_conflict") {
      expect(conflictWarning.patientIds).toContain("patient-ravi");
      expect(conflictWarning.patientIds).toContain("patient-deep");
    }
  });

  it("does not emit window_conflict when two fixed patients can be served in sequence", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "First Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Second Address", coords: { lat: 43.8, lon: -79.8 } },
      { address: "End", coords: { lat: 43.9, lon: -79.9 } },
    ]);

    // Travel matrix: 600s (10 min) between patients — can serve first at 08:30, finish at 09:00, travel 10 min, serve second by 09:10
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:first address", 600],
        ["address:start", "address:second address", 600],
        ["address:first address", "address:second address", 600],
        ["address:second address", "address:first address", 600],
        ["address:first address", "address:end", 600],
        ["address:second address", "address:end", 600],
      ]),
    );

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
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-first",
            patientId: "patient-first",
            patientName: "First Patient",
            address: "First Address",
            windowStart: "08:00",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-second",
            patientId: "patient-second",
            patientName: "Second Patient",
            address: "Second Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const conflictWarning = result.warnings?.find((w) => w.type === "window_conflict");
    expect(conflictWarning).toBeUndefined();
  });

  it("emits fixed_late warning when fixed patient is more than 15 min past window close", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    // Departure 07:30, window closes 09:00, travel = 7020s → arrive 09:27 → 27 min late
    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops: [
        {
          address: "Fixed Address",
          coords: { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 10,
          durationFromPreviousSeconds: 7020,
        },
        {
          address: "End",
          coords: { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: "Fixed Address",
          distanceMeters: 10000,
          durationSeconds: 7020,
          encodedPolyline: "a",
        },
        {
          fromAddress: "Fixed Address",
          toAddress: "End",
          distanceMeters: 2000,
          durationSeconds: 600,
          encodedPolyline: "b",
        },
      ],
      totalDistanceMeters: 12000,
      totalDistanceKm: 12,
      totalDurationSeconds: 7620,
    });

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00.000Z",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "fixed-late",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Fixed Address",
            windowStart: "09:00",
            windowEnd: "09:00",
            windowType: "fixed",
            serviceDurationMinutes: 10,
          },
        ],
      },
      "google-key",
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]).toMatchObject({
      type: "fixed_late",
      patientId: "patient-fixed",
      patientName: "Fixed Patient",
    });
  });

  it("emits flexible_late warning when flexible patient with preferred window is more than 60 min past window close", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Flex Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    // Departure 07:30, window closes 08:00, travel = 7200s → arrive 09:30 → 90 min late
    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops: [
        {
          address: "Flex Address",
          coords: { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 10,
          durationFromPreviousSeconds: 7200,
        },
        {
          address: "End",
          coords: { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: "Flex Address",
          distanceMeters: 10000,
          durationSeconds: 7200,
          encodedPolyline: "a",
        },
        {
          fromAddress: "Flex Address",
          toAddress: "End",
          distanceMeters: 2000,
          durationSeconds: 600,
          encodedPolyline: "b",
        },
      ],
      totalDistanceMeters: 12000,
      totalDistanceKm: 12,
      totalDurationSeconds: 7800,
    });

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00.000Z",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "flex-late",
            patientId: "patient-flex",
            patientName: "Flexible Patient",
            address: "Flex Address",
            windowStart: "07:00",
            windowEnd: "08:00",
            windowType: "flexible",
            serviceDurationMinutes: 10,
          },
        ],
      },
      "google-key",
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]).toMatchObject({
      type: "flexible_late",
      patientId: "patient-flex",
      patientName: "Flexible Patient",
    });
  });

  it("schedules a tight-window flexible patient before a closer wide-window patient to avoid missing the deadline (EDF)", async () => {
    // Shirley: flexible 09:30-10:00 window, 15 min service, 45 min from start
    // Wide:    flexible 09:00-17:00 window, 15 min service, 2 min from start
    // Without EDF: Wide goes first (nearest), then Shirley arrives 10:37 → 37 min late
    // With EDF:    Shirley goes first (urgency detected), arrives 09:45 → on time
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Shirley Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Wide Address", coords: { lat: 43.6002, lon: -79.6002 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:shirley address", 2700], // 45 min
        ["address:start", "address:wide address", 120], // 2 min
        ["address:shirley address", "address:wide address", 4800], // 80 min
        ["address:wide address", "address:shirley address", 4800], // 80 min
        ["address:shirley address", "address:end", 600],
        ["address:wide address", "address:end", 600],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T09:00:00.000Z",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-shirley",
            patientId: "patient-shirley",
            patientName: "Shirley",
            address: "Shirley Address",
            windowStart: "09:30",
            windowEnd: "10:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-wide",
            patientId: "patient-wide",
            patientName: "Wide",
            address: "Wide Address",
            windowStart: "09:00",
            windowEnd: "17:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedAddresses = (call?.[1] ?? []).map((s) => s.address);
    // Shirley should be scheduled before Wide
    expect(passedAddresses.indexOf("Shirley Address")).toBeLessThan(
      passedAddresses.indexOf("Wide Address"),
    );
    // Shirley should be on time
    const shirleyTask = result.orderedStops
      .flatMap((s) => s.tasks)
      .find((t) => t.visitId === "visit-shirley");
    expect(shirleyTask?.lateBySeconds).toBe(0);
  });

  it("emits no warnings when all patients are within tolerance", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    // Departure 07:30, window 09:00-10:00, travel = 5400s → arrive 09:00 exactly → 0 min late
    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops: [
        {
          address: "Fixed Address",
          coords: { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 10,
          durationFromPreviousSeconds: 5400,
        },
        {
          address: "End",
          coords: { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: "Fixed Address",
          distanceMeters: 10000,
          durationSeconds: 5400,
          encodedPolyline: "a",
        },
        {
          fromAddress: "Fixed Address",
          toAddress: "End",
          distanceMeters: 2000,
          durationSeconds: 600,
          encodedPolyline: "b",
        },
      ],
      totalDistanceMeters: 12000,
      totalDistanceKm: 12,
      totalDurationSeconds: 6000,
    });

    const result = await optimizeRouteV2(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:30:00.000Z",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "fixed-ontime",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Fixed Address",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    expect(result.warnings).toBeUndefined();
  });

  it("schedules an already-late fixed patient before a no-window patient rather than letting the no-window fill the gap", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "First Fixed", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Second Fixed", coords: { lat: 43.705, lon: -79.705 } },
      { address: "Far Future Fixed", coords: { lat: 43.8, lon: -79.8 } },
      { address: "No Window", coords: { lat: 43.701, lon: -79.701 } },
      { address: "End", coords: { lat: 43.9, lon: -79.9 } },
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
          departureTime: "2026-03-13T08:30:00-04:00",
        },
        end: { address: "End" },
        visits: [
          {
            visitId: "first-fixed",
            patientId: "patient-first",
            patientName: "First Fixed",
            address: "First Fixed",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 60,
          },
          {
            visitId: "second-fixed",
            patientId: "patient-second",
            patientName: "Second Fixed",
            address: "Second Fixed",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "far-future-fixed",
            patientId: "patient-future",
            patientName: "Far Future Fixed",
            address: "Far Future Fixed",
            windowStart: "17:00",
            windowEnd: "18:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "no-window",
            patientId: "patient-no-window",
            patientName: "No Window",
            address: "No Window",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 30,
          },
        ],
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const stopAddresses = (call?.[1] ?? []).map((stop) => stop.address);

    // No-window patient must NOT appear before both same-window fixed patients
    const firstFixedIndex = stopAddresses.indexOf("First Fixed");
    const secondFixedIndex = stopAddresses.indexOf("Second Fixed");
    const noWindowIndex = stopAddresses.indexOf("No Window");

    // Both same-window fixed patients should appear before the no-window patient
    expect(noWindowIndex).toBeGreaterThan(firstFixedIndex);
    expect(noWindowIndex).toBeGreaterThan(secondFixedIndex);
  });

  it("throws when dynamic departure planningDate is invalid", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    await expect(
      optimizeRouteV2(
        {
          planningDate: "invalid-date",
          timezone: "UTC",
          start: {
            address: "Start",
          },
          end: {
            address: "End",
          },
          visits: [],
        } as never,
        "google-key",
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "planningDate must be a valid calendar date.",
    });
  });
});
