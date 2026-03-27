import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../geocoding", () => ({
  geocodeTargetsSequentially: vi.fn(),
  normalizeAddressKey: (address: string) => address.trim().toLowerCase(),
}));

vi.mock("../routing", () => ({
  buildDrivingRoute: vi.fn(),
}));

vi.mock("../v2/travelMatrix", () => ({
  buildPlanningTravelDurationMatrix: vi.fn(),
}));

import { geocodeTargetsSequentially } from "../geocoding";
import { buildDrivingRoute } from "../routing";
import { buildPlanningTravelDurationMatrix } from "../v2/travelMatrix";
import { optimizeRouteV2 } from "../v2/optimizeRouteService";
import { optimizeRouteV3 } from "./optimizeRouteService";

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

const buildDenseTravelMatrix = (addresses: string[], durations: number[]) => {
  const matrix = new Map<string, Map<string, number>>();
  let cursor = 0;

  addresses.forEach((fromAddress) => {
    const fromKey = `address:${fromAddress.toLowerCase()}`;
    const row = new Map<string, number>();

    addresses.forEach((toAddress) => {
      const toKey = `address:${toAddress.toLowerCase()}`;
      if (fromKey === toKey) {
        row.set(toKey, 0);
        return;
      }

      row.set(toKey, durations[cursor] ?? 0);
      cursor += 1;
    });

    matrix.set(fromKey, row);
  });

  return matrix;
};

const buildLocationKey = ({
  address,
  googlePlaceId,
}: {
  address: string;
  googlePlaceId?: string | null;
}) => {
  if (googlePlaceId && googlePlaceId.trim().length > 0) {
    return `place:${googlePlaceId.trim()}`;
  }

  return `address:${address.trim().toLowerCase()}`;
};

const buildTravelMatrixByLabel = (
  nodes: Array<{
    label: string;
    address: string;
    googlePlaceId?: string | null;
  }>,
  defaultDurationSeconds: number,
  overrides: Array<[fromLabel: string, toLabel: string, durationSeconds: number]>,
) => {
  const keyByLabel = new Map(nodes.map((node) => [node.label, buildLocationKey(node)]));
  const matrix = new Map<string, Map<string, number>>();

  nodes.forEach((fromNode) => {
    const fromKey = keyByLabel.get(fromNode.label);
    if (!fromKey) {
      return;
    }

    const row = new Map<string, number>();
    nodes.forEach((toNode) => {
      const toKey = keyByLabel.get(toNode.label);
      if (!toKey) {
        return;
      }

      row.set(toKey, fromKey === toKey ? 0 : defaultDurationSeconds);
    });

    matrix.set(fromKey, row);
  });

  overrides.forEach(([fromLabel, toLabel, durationSeconds]) => {
    const fromKey = keyByLabel.get(fromLabel);
    const toKey = keyByLabel.get(toLabel);
    if (!fromKey || !toKey) {
      return;
    }

    const row = matrix.get(fromKey);
    if (!row) {
      return;
    }

    row.set(toKey, durationSeconds);
  });

  return matrix;
};

const routeCost = (order: string[], matrix: Map<string, Map<string, number>>) => {
  const stops = ["Start", ...order];
  let total = 0;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const fromKey = `address:${stops[index]?.toLowerCase()}`;
    const toKey = `address:${stops[index + 1]?.toLowerCase()}`;
    total += matrix.get(fromKey)?.get(toKey) ?? 0;
  }

  return total;
};

describe("optimizeRouteV3 service", () => {
  beforeEach(() => {
    mockedGeocodeTargetsSequentially.mockReset();
    mockedBuildDrivingRoute.mockReset();
    mockedBuildPlanningTravelDurationMatrix.mockReset();
    mockedBuildPlanningTravelDurationMatrix.mockRejectedValue(new Error("matrix unavailable"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Shortcut No-Window",
          coords: orderedStops[0]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.5,
          durationFromPreviousSeconds: 300,
        },
        {
          address: orderedStops[1]?.address ?? "Fixed Late Address",
          coords: orderedStops[1]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "End",
          coords: orderedStops[2]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          distanceMeters: 500,
          durationSeconds: 300,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          toAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          toAddress: orderedStops[2]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 600,
          encodedPolyline: "c",
        },
      ],
      totalDistanceMeters: 1600,
      totalDistanceKm: 1.6,
      totalDurationSeconds: 960,
    }));

    await optimizeRouteV3(
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
        optimizationObjective: "time",
      },
      "google-key",
    );

    const call = mockedBuildDrivingRoute.mock.calls[0];
    const passedOrderedStops = call?.[1] ?? [];
    // "time" objective should avoid anchoring on far-future fixed windows when
    // there is no immediate fixed-risk.
    const stopAddresses = passedOrderedStops.map((stop) => stop.address);
    expect(stopAddresses[0]).toBe("Address B");
    expect(stopAddresses[stopAddresses.length - 1]).toBe("End");
    expect(stopAddresses.indexOf("Address D")).toBeGreaterThan(stopAddresses.indexOf("Address A"));
    expect(stopAddresses.indexOf("Address D")).toBeGreaterThan(stopAddresses.indexOf("Address C"));
  });

  it("improves a seeded local minimum when the matrix exposes a better flexible ordering", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "D", coords: { lat: 43.64, lon: -79.64 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Fixed A",
          coords: orderedStops[0]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 20 * 60,
        },
        {
          address: orderedStops[1]?.address ?? "No Window",
          coords: orderedStops[1]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "Fixed B",
          coords: orderedStops[2]?.coords ?? { lat: 43.72, lon: -79.72 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[3]?.address ?? "End",
          coords: orderedStops[3]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 10 * 60,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Fixed A",
          distanceMeters: 2000,
          durationSeconds: 20 * 60,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Fixed A",
          toAddress: orderedStops[1]?.address ?? "No Window",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "No Window",
          toAddress: orderedStops[2]?.address ?? "Fixed B",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "c",
        },
        {
          fromAddress: orderedStops[2]?.address ?? "Fixed B",
          toAddress: orderedStops[3]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 10 * 60,
          encodedPolyline: "d",
        },
      ],
      totalDistanceMeters: 3200,
      totalDistanceKm: 3.2,
      totalDurationSeconds: 22 * 60,
    }));

    const matrix = buildDenseTravelMatrix(
      ["Start", "A", "B", "C", "D", "End"],
      [
        2366, 654, 2046, 958, 2373, 1072, 1051, 1312, 664, 600, 2022, 2458, 2328, 1315, 234, 2415,
        2107, 524, 1785, 1209, 233, 1494, 2374, 1812, 1218, 1616, 841, 1500, 315, 2075,
      ],
    );
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(matrix);

    const request = {
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
          patientName: "A",
          address: "A",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 20,
        },
        {
          visitId: "visit-b",
          patientId: "patient-b",
          patientName: "B",
          address: "B",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 21,
        },
        {
          visitId: "visit-c",
          patientId: "patient-c",
          patientName: "C",
          address: "C",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 22,
        },
        {
          visitId: "visit-d",
          patientId: "patient-d",
          patientName: "D",
          address: "D",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 23,
        },
      ],
    };

    const v2Result = await optimizeRouteV2(request, "google-key");
    const v3Result = await optimizeRouteV3(request, "google-key");
    const v2Order = v2Result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    const v3Order = v3Result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);

    expect(v2Order).toEqual(["B", "D", "A", "C"]);
    expect(v3Order).toEqual(["D", "A", "C", "B"]);
    expect(routeCost(v3Order, matrix)).toBeLessThan(routeCost(v2Order, matrix));
  });

  it("logs seed versus ILS diagnostics when shadow comparison is enabled", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Near", coords: { lat: 43.6001, lon: -79.6001 } },
      { address: "Far", coords: { lat: 43.75, lon: -79.75 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Shortcut No-Window",
          coords: orderedStops[0]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.5,
          durationFromPreviousSeconds: 300,
        },
        {
          address: orderedStops[1]?.address ?? "Fixed Late Address",
          coords: orderedStops[1]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "End",
          coords: orderedStops[2]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          distanceMeters: 500,
          durationSeconds: 300,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          toAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          toAddress: orderedStops[2]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 600,
          encodedPolyline: "c",
        },
      ],
      totalDistanceMeters: 1600,
      totalDistanceKm: 1.6,
      totalDurationSeconds: 960,
    }));

    await optimizeRouteV3(
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
            address: "Near",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-far",
            patientId: "patient-far",
            patientName: "Far Patient",
            address: "Far",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
      {
        requestId: "req-shadow-1",
        nurseId: "nurse-1",
        shadowCompare: true,
      },
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[optimize-route-v3-shadow]",
      expect.objectContaining({
        requestId: "req-shadow-1",
        nurseId: "nurse-1",
        visitCount: 2,
        fixedVisitCount: 0,
        openFlexibleVisitCount: 2,
        windowedFlexibleVisitCount: 0,
        preserveOrder: false,
        objective: "distance",
      }),
    );
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

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Fixed A",
          coords: orderedStops[0]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 20 * 60,
        },
        {
          address: orderedStops[1]?.address ?? "No Window",
          coords: orderedStops[1]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "Fixed B",
          coords: orderedStops[2]?.coords ?? { lat: 43.72, lon: -79.72 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[3]?.address ?? "End",
          coords: orderedStops[3]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 10 * 60,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Fixed A",
          distanceMeters: 2000,
          durationSeconds: 20 * 60,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Fixed A",
          toAddress: orderedStops[1]?.address ?? "No Window",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "No Window",
          toAddress: orderedStops[2]?.address ?? "Fixed B",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "c",
        },
        {
          fromAddress: orderedStops[2]?.address ?? "Fixed B",
          toAddress: orderedStops[3]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 10 * 60,
          encodedPolyline: "d",
        },
      ],
      totalDistanceMeters: 3200,
      totalDistanceKm: 3.2,
      totalDurationSeconds: 22 * 60,
    }));

    await optimizeRouteV3(
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
    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Shortcut No-Window",
          coords: orderedStops[0]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.5,
          durationFromPreviousSeconds: 300,
        },
        {
          address: orderedStops[1]?.address ?? "Fixed Late Address",
          coords: orderedStops[1]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "End",
          coords: orderedStops[2]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          distanceMeters: 500,
          durationSeconds: 300,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          toAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          toAddress: orderedStops[2]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 600,
          encodedPolyline: "c",
        },
      ],
      totalDistanceMeters: 1600,
      totalDistanceKm: 1.6,
      totalDurationSeconds: 960,
    }));

    await optimizeRouteV3(
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

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Fixed A",
          coords: orderedStops[0]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 20 * 60,
        },
        {
          address: orderedStops[1]?.address ?? "No Window",
          coords: orderedStops[1]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "Fixed B",
          coords: orderedStops[2]?.coords ?? { lat: 43.72, lon: -79.72 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[3]?.address ?? "End",
          coords: orderedStops[3]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 10 * 60,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Fixed A",
          distanceMeters: 2000,
          durationSeconds: 20 * 60,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Fixed A",
          toAddress: orderedStops[1]?.address ?? "No Window",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "No Window",
          toAddress: orderedStops[2]?.address ?? "Fixed B",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "c",
        },
        {
          fromAddress: orderedStops[2]?.address ?? "Fixed B",
          toAddress: orderedStops[3]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 10 * 60,
          encodedPolyline: "d",
        },
      ],
      totalDistanceMeters: 3200,
      totalDistanceKm: 3.2,
      totalDurationSeconds: 22 * 60,
    }));

    await optimizeRouteV3(
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

    await optimizeRouteV3(
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

    await optimizeRouteV3(
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

    await optimizeRouteV3(
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
        optimizationObjective: "time",
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

  it("uses sequence gap-filling before a flexible preferred-window anchor in finish-sooner mode", async () => {
    let nowCalls = 0;
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockImplementation(() => (nowCalls++ === 0 ? 0 : 1000));

    const startAddress = "Start";
    const visits = [
      {
        label: "early",
        visitId: "visit-early",
        patientId: "patient-early",
        patientName: "Early Flexible",
        address: "Early Visit",
        windowStart: "09:00",
        windowEnd: "10:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "anchor",
        visitId: "visit-anchor",
        patientId: "patient-anchor",
        patientName: "Nancy Price",
        address: "Flexible Anchor",
        windowStart: "10:30",
        windowEnd: "14:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "long",
        visitId: "visit-long",
        patientId: "patient-long",
        patientName: "Ernst Vonarburg",
        address: "Long Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 35,
      },
      {
        label: "short",
        visitId: "visit-short",
        patientId: "patient-short",
        patientName: "Catherine Nguemelieu Epse Djom",
        address: "Short Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 5,
      },
    ];

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.6, lon: -79.6 } },
      ...visits.map((visit, index) => ({
        address: visit.address,
        coords: { lat: 43.61 + index * 0.001, lon: -79.61 + index * 0.001 },
      })),
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      ...visits.map(({ label, address }) => ({ label, address })),
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "early", 5 * 60],
        ["early", "anchor", 5 * 60],
        ["early", "long", 5 * 60],
        ["early", "short", 20 * 60],
        ["long", "anchor", 5 * 60],
        ["long", "short", 60],
        ["short", "anchor", 60],
        ["anchor", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-24",
        timezone: "America/Toronto",
        start: { address: startAddress, departureTime: "2026-03-24T09:00:00-04:00" },
        end: { address: "End" },
        visits: visits.map((visit) => {
          const visitWithoutLabel = { ...visit };
          delete (visitWithoutLabel as { label?: string }).label;
          return visitWithoutLabel;
        }),
        optimizationObjective: "time",
      },
      "google-key",
    );
    dateNowSpy.mockRestore();

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual([
      "Early Flexible",
      "Ernst Vonarburg",
      "Catherine Nguemelieu Epse Djom",
      "Nancy Price",
    ]);
    expect(result.metrics.totalLateSeconds).toBe(0);
  });

  it("time mode accepts up to 10 minutes extra elapsed to reduce a large single idle gap", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Visit A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Visit B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "Visit C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "End", coords: { lat: 43.64, lon: -79.64 } },
    ]);

    const nodes = [
      { label: "start", address: "Start" },
      { label: "a", address: "Visit A" },
      { label: "b", address: "Visit B" },
      { label: "c", address: "Visit C" },
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "a", 5 * 60],
        ["a", "b", 5 * 60],
        ["a", "c", 25 * 60],
        ["b", "c", 30 * 60],
        ["c", "b", 30 * 60],
        ["b", "end", 5 * 60],
        ["c", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: { address: "Start", departureTime: "2026-03-27T09:00:00-04:00" },
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Visit A",
            address: "Visit A",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b",
            patientId: "patient-b",
            patientName: "Visit B",
            address: "Visit B",
            windowStart: "10:10",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-c",
            patientId: "patient-c",
            patientName: "Visit C",
            address: "Visit C",
            windowStart: "10:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "time",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual(["Visit A", "Visit C", "Visit B"]);
  });

  it("time mode hard cap prefers lower max-idle route even when elapsed is more than 10 minutes worse", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Visit A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Visit B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "Visit C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "End", coords: { lat: 43.64, lon: -79.64 } },
    ]);

    const nodes = [
      { label: "start", address: "Start" },
      { label: "a", address: "Visit A" },
      { label: "b", address: "Visit B" },
      { label: "c", address: "Visit C" },
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "a", 5 * 60],
        ["a", "b", 5 * 60],
        ["a", "c", 35 * 60],
        ["b", "c", 30 * 60],
        ["c", "b", 30 * 60],
        ["b", "end", 5 * 60],
        ["c", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: { address: "Start", departureTime: "2026-03-27T09:00:00-04:00" },
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Visit A",
            address: "Visit A",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b",
            patientId: "patient-b",
            patientName: "Visit B",
            address: "Visit B",
            windowStart: "10:30",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-c",
            patientId: "patient-c",
            patientName: "Visit C",
            address: "Visit C",
            windowStart: "10:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "time",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual(["Visit A", "Visit C", "Visit B"]);
  });

  it("time mode does not apply idle-gap smoothing when max idle gap is 30 minutes or less", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Visit A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Visit B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "Visit C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "End", coords: { lat: 43.64, lon: -79.64 } },
    ]);

    const nodes = [
      { label: "start", address: "Start" },
      { label: "a", address: "Visit A" },
      { label: "b", address: "Visit B" },
      { label: "c", address: "Visit C" },
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "a", 5 * 60],
        ["a", "b", 5 * 60],
        ["a", "c", 25 * 60],
        ["b", "c", 30 * 60],
        ["c", "b", 30 * 60],
        ["b", "end", 5 * 60],
        ["c", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: { address: "Start", departureTime: "2026-03-27T09:00:00-04:00" },
        end: { address: "End" },
        visits: [
          {
            visitId: "visit-a",
            patientId: "patient-a",
            patientName: "Visit A",
            address: "Visit A",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b",
            patientId: "patient-b",
            patientName: "Visit B",
            address: "Visit B",
            windowStart: "09:55",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-c",
            patientId: "patient-c",
            patientName: "Visit C",
            address: "Visit C",
            windowStart: "10:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "time",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual(["Visit A", "Visit B", "Visit C"]);
  });

  it("time mode does not anchor on a far-future fixed visit when it is not yet due", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Nancy Address", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Ian Address", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:nancy address", 5 * 60],
        ["address:start", "address:ian address", 5 * 60],
        ["address:start", "address:end", 5 * 60],
        ["address:nancy address", "address:start", 5 * 60],
        ["address:nancy address", "address:ian address", 5 * 60],
        ["address:nancy address", "address:end", 5 * 60],
        ["address:ian address", "address:start", 5 * 60],
        ["address:ian address", "address:nancy address", 5 * 60],
        ["address:ian address", "address:end", 5 * 60],
        ["address:end", "address:start", 5 * 60],
        ["address:end", "address:nancy address", 5 * 60],
        ["address:end", "address:ian address", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-27T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-ian-fixed",
            patientId: "patient-ian-fixed",
            patientName: "Ian Mcadam",
            address: "Ian Address",
            windowStart: "12:10",
            windowEnd: "12:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-nancy-windowed",
            patientId: "patient-nancy-windowed",
            patientName: "Nancy Price",
            address: "Nancy Address",
            windowStart: "11:00",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "time",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops.map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Nancy Address", "Ian Address", "End"]);

    const ianTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-ian-fixed");
    expect(ianTask?.lateBySeconds).toBe(0);
  });

  it("distance mode can defer a far-future fixed visit to avoid avoidable idle/lateness", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Nancy Address", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Ian Address", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:nancy address", 5 * 60],
        ["address:start", "address:ian address", 5 * 60],
        ["address:start", "address:end", 5 * 60],
        ["address:nancy address", "address:start", 5 * 60],
        ["address:nancy address", "address:ian address", 5 * 60],
        ["address:nancy address", "address:end", 5 * 60],
        ["address:ian address", "address:start", 5 * 60],
        ["address:ian address", "address:nancy address", 5 * 60],
        ["address:ian address", "address:end", 5 * 60],
        ["address:end", "address:start", 5 * 60],
        ["address:end", "address:nancy address", 5 * 60],
        ["address:end", "address:ian address", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-27T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-ian-fixed-distance",
            patientId: "patient-ian-fixed-distance",
            patientName: "Ian Mcadam",
            address: "Ian Address",
            windowStart: "12:10",
            windowEnd: "12:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-nancy-windowed-distance",
            patientId: "patient-nancy-windowed-distance",
            patientName: "Nancy Price",
            address: "Nancy Address",
            windowStart: "11:00",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops.map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Nancy Address", "Ian Address", "End"]);

    const ianTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-ian-fixed-distance");
    expect(ianTask?.lateBySeconds).toBe(0);
  });

  it("distance mode serves a tight flexible visit before a far-future fixed visit when fixed remains feasible", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Anchor", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Tight Flexible", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:fixed anchor", 5 * 60],
        ["address:start", "address:tight flexible", 5 * 60],
        ["address:start", "address:end", 5 * 60],
        ["address:fixed anchor", "address:start", 5 * 60],
        ["address:fixed anchor", "address:tight flexible", 5 * 60],
        ["address:fixed anchor", "address:end", 5 * 60],
        ["address:tight flexible", "address:start", 5 * 60],
        ["address:tight flexible", "address:fixed anchor", 5 * 60],
        ["address:tight flexible", "address:end", 5 * 60],
        ["address:end", "address:start", 5 * 60],
        ["address:end", "address:fixed anchor", 5 * 60],
        ["address:end", "address:tight flexible", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-27T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-fixed-anchor-distance",
            patientId: "patient-fixed-anchor-distance",
            patientName: "Fixed Anchor",
            address: "Fixed Anchor",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-tight-flexible-distance",
            patientId: "patient-tight-flexible-distance",
            patientName: "Tight Flexible",
            address: "Tight Flexible",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "flexible",
            serviceDurationMinutes: 10,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Tight Flexible", "Fixed Anchor"]);

    const fixedTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-fixed-anchor-distance");
    expect(fixedTask?.lateBySeconds).toBe(0);
  });

  it("distance mode still keeps near-due fixed visits ahead of flexible visits", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Near Fixed", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Flexible", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:near fixed", 5 * 60],
        ["address:start", "address:flexible", 5 * 60],
        ["address:start", "address:end", 5 * 60],
        ["address:near fixed", "address:start", 5 * 60],
        ["address:near fixed", "address:flexible", 5 * 60],
        ["address:near fixed", "address:end", 5 * 60],
        ["address:flexible", "address:start", 5 * 60],
        ["address:flexible", "address:near fixed", 5 * 60],
        ["address:flexible", "address:end", 5 * 60],
        ["address:end", "address:start", 5 * 60],
        ["address:end", "address:near fixed", 5 * 60],
        ["address:end", "address:flexible", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-27T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-near-fixed-distance",
            patientId: "patient-near-fixed-distance",
            patientName: "Near Fixed",
            address: "Near Fixed",
            windowStart: "09:20",
            windowEnd: "09:40",
            windowType: "fixed",
            serviceDurationMinutes: 10,
          },
          {
            visitId: "visit-flexible-distance",
            patientId: "patient-flexible-distance",
            patientName: "Flexible",
            address: "Flexible",
            windowStart: "09:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops.map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Near Fixed", "Flexible", "End"]);

    const fixedTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-near-fixed-distance");
    expect(fixedTask?.lateBySeconds).toBe(0);
  });

  it("reduces long idle gaps in less-driving mode when extra travel stays within tolerance", async () => {
    const startAddress = "Start";
    const visits = [
      {
        label: "early",
        visitId: "visit-early",
        patientId: "patient-early",
        patientName: "Early Flexible",
        address: "Early Visit",
        windowStart: "09:00",
        windowEnd: "10:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "anchor",
        visitId: "visit-anchor",
        patientId: "patient-anchor",
        patientName: "Nancy Price",
        address: "Flexible Anchor",
        windowStart: "12:10",
        windowEnd: "14:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "long",
        visitId: "visit-long",
        patientId: "patient-long",
        patientName: "Ernst Vonarburg",
        address: "Long Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 35,
      },
      {
        label: "short",
        visitId: "visit-short",
        patientId: "patient-short",
        patientName: "Catherine Nguemelieu Epse Djom",
        address: "Short Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
    ];

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.6, lon: -79.6 } },
      ...visits.map((visit, index) => ({
        address: visit.address,
        coords: { lat: 43.61 + index * 0.001, lon: -79.61 + index * 0.001 },
      })),
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      ...visits.map(({ label, address }) => ({ label, address })),
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "early", 5 * 60],
        ["early", "anchor", 60],
        ["early", "long", 5 * 60],
        ["early", "short", 20 * 60],
        ["long", "anchor", 60],
        ["anchor", "short", 60],
        ["long", "short", 3 * 60],
        ["short", "anchor", 3 * 60],
        ["anchor", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-24",
        timezone: "America/Toronto",
        start: { address: startAddress, departureTime: "2026-03-24T09:00:00-04:00" },
        end: { address: "End" },
        visits: visits.map((visit) => {
          const visitWithoutLabel = { ...visit };
          delete (visitWithoutLabel as { label?: string }).label;
          return visitWithoutLabel;
        }),
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual([
      "Early Flexible",
      "Ernst Vonarburg",
      "Catherine Nguemelieu Epse Djom",
      "Nancy Price",
    ]);
  });

  it("keeps travel-first ordering in less-driving mode when idle-gap improvement exceeds travel tolerance", async () => {
    const startAddress = "Start";
    const visits = [
      {
        label: "early",
        visitId: "visit-early",
        patientId: "patient-early",
        patientName: "Early Flexible",
        address: "Early Visit",
        windowStart: "09:00",
        windowEnd: "10:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "anchor",
        visitId: "visit-anchor",
        patientId: "patient-anchor",
        patientName: "Nancy Price",
        address: "Flexible Anchor",
        windowStart: "12:10",
        windowEnd: "14:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "long",
        visitId: "visit-long",
        patientId: "patient-long",
        patientName: "Ernst Vonarburg",
        address: "Long Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 35,
      },
      {
        label: "short",
        visitId: "visit-short",
        patientId: "patient-short",
        patientName: "Catherine Nguemelieu Epse Djom",
        address: "Short Filler",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
    ];

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.6, lon: -79.6 } },
      ...visits.map((visit, index) => ({
        address: visit.address,
        coords: { lat: 43.61 + index * 0.001, lon: -79.61 + index * 0.001 },
      })),
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      ...visits.map(({ label, address }) => ({ label, address })),
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "early", 5 * 60],
        ["early", "anchor", 60],
        ["early", "long", 5 * 60],
        ["early", "short", 20 * 60],
        ["long", "anchor", 60],
        ["anchor", "short", 60],
        ["long", "short", 6 * 60],
        ["short", "anchor", 6 * 60],
        ["anchor", "end", 5 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-24",
        timezone: "America/Toronto",
        start: { address: startAddress, departureTime: "2026-03-24T09:00:00-04:00" },
        end: { address: "End" },
        visits: visits.map((visit) => {
          const visitWithoutLabel = { ...visit };
          delete (visitWithoutLabel as { label?: string }).label;
          return visitWithoutLabel;
        }),
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    expect(actualOrder).toEqual([
      "Early Flexible",
      "Ernst Vonarburg",
      "Nancy Price",
      "Catherine Nguemelieu Epse Djom",
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

    const result = await optimizeRouteV3(
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

  it("delays implicit departure in time mode when the selected order can absorb the shift without lateness", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Flexible Visit", coords: { lat: 43.61, lon: -79.61 } },
      { address: "Fixed Visit", coords: { lat: 43.62, lon: -79.62 } },
      { address: "End", coords: { lat: 43.63, lon: -79.63 } },
    ]);

    const nodes = [
      { label: "start", address: "Start" },
      { label: "flex", address: "Flexible Visit" },
      { label: "fixed", address: "Fixed Visit" },
      { label: "end", address: "End" },
    ];
    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "flex", 15 * 60],
        ["start", "fixed", 20 * 60],
        ["flex", "fixed", 15 * 60],
        ["fixed", "flex", 15 * 60],
        ["flex", "end", 10 * 60],
        ["fixed", "end", 10 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-flex",
            patientId: "patient-flex",
            patientName: "Flexible Patient",
            address: "Flexible Visit",
            windowStart: "09:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-fixed",
            patientId: "patient-fixed",
            patientName: "Fixed Patient",
            address: "Fixed Visit",
            windowStart: "12:10",
            windowEnd: "12:30",
            windowType: "fixed",
            serviceDurationMinutes: 20,
          },
        ],
        optimizationObjective: "time",
      },
      "google-key",
    );

    expect(result.start.departureTime).toBe("2026-03-27T15:20:00.000Z");

    const stopAddresses = result.orderedStops.map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Flexible Visit", "Fixed Visit", "End"]);

    const fixedTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-fixed");
    expect(fixedTask?.lateBySeconds).toBe(0);
  });

  it("marks a preferred-window visit late when service ends after the window closes", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Gary Address", coords: { lat: 43.61, lon: -79.61 } },
      { address: "End", coords: { lat: 43.62, lon: -79.62 } },
    ]);

    mockedBuildDrivingRoute.mockResolvedValue(buildDrivingRouteResult(["Gary Address", "End"]));

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-27",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-27T14:15:00.000Z",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-gary",
            patientId: "patient-gary",
            patientName: "Gary Frauts",
            address: "Gary Address",
            windowStart: "08:30",
            windowEnd: "10:30",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
      },
      "google-key",
    );

    const garyTask = result.orderedStops[0]?.tasks[0];
    expect(garyTask?.serviceStartTime).toBe("2026-03-27T14:25:00.000Z");
    expect(garyTask?.serviceEndTime).toBe("2026-03-27T14:45:00.000Z");
    expect(garyTask?.lateBySeconds).toBe(15 * 60);
    expect(garyTask?.onTime).toBe(false);
  });

  it("throws when geocoding returns fewer targets than required", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
    ]);

    await expect(
      optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    expect(result.algorithmVersion).toBe("v3.0.0-ils-seeded");
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

    const result = await optimizeRouteV3(
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
    expect(result.algorithmVersion).toBe("v3.0.0-ils-seeded/preserved");
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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
          durationFromPreviousSeconds: 1,
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
          durationSeconds: 1,
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
      totalDurationSeconds: 601,
    });

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-13",
        timezone: "UTC",
        start: {
          address: "Start",
          departureTime: "2026-03-13T07:59:00.000Z",
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
            serviceDurationMinutes: 1,
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

    const result = await optimizeRouteV3(
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

    await optimizeRouteV3(
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

  it("keeps output on the lower fixed-slack route even when an alternative has much lower travel", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Ravi Fixed", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Jing Flexible", coords: { lat: 43.601, lon: -79.601 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(
        [
          { label: "start", address: "Start" },
          { label: "ravi", address: "Ravi Fixed" },
          { label: "jing", address: "Jing Flexible" },
          { label: "end", address: "End" },
        ],
        40 * 60,
        [
          ["start", "ravi", 40 * 60],
          ["start", "jing", 5 * 60],
          ["jing", "ravi", 5 * 60],
          ["ravi", "jing", 40 * 60],
          ["ravi", "end", 10 * 60],
          ["jing", "end", 10 * 60],
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
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
            visitId: "visit-ravi-fixed-slack",
            patientId: "patient-ravi-fixed-slack",
            patientName: "Ravi Fixed",
            address: "Ravi Fixed",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-jing-flexible-slack",
            patientId: "patient-jing-flexible-slack",
            patientName: "Jing Flexible",
            address: "Jing Flexible",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 45,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Ravi Fixed", "Jing Flexible"]);
  });

  it("keeps final output fixed-slack-protected under seeded perturbations", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Ravi Drift Guard", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Jing Drift Guard", coords: { lat: 43.601, lon: -79.601 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(
        [
          { label: "start", address: "Start" },
          { label: "ravi", address: "Ravi Drift Guard" },
          { label: "jing", address: "Jing Drift Guard" },
          { label: "end", address: "End" },
        ],
        40 * 60,
        [
          ["start", "ravi", 40 * 60],
          ["start", "jing", 5 * 60],
          ["jing", "ravi", 5 * 60],
          ["ravi", "jing", 40 * 60],
          ["ravi", "end", 10 * 60],
          ["jing", "end", 10 * 60],
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
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
            visitId: "visit-ravi-drift-guard",
            patientId: "patient-ravi-drift-guard",
            patientName: "Ravi Drift Guard",
            address: "Ravi Drift Guard",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 30,
          },
          {
            visitId: "visit-jing-drift-guard",
            patientId: "patient-jing-drift-guard",
            patientName: "Jing Drift Guard",
            address: "Jing Drift Guard",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 45,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
      {
        requestId: "seed-fixed-slack-guard",
        nurseId: "nurse-fixed-slack-guard",
        shadowCompare: false,
      },
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Ravi Drift Guard", "Jing Drift Guard"]);
  });

  it("does not move a preferred-window flexible visit ahead of a near-due fixed anchor when that only burns fixed slack", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Anchor", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Windowed Flexible", coords: { lat: 43.601, lon: -79.601 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(
        [
          { label: "start", address: "Start" },
          { label: "fixed", address: "Fixed Anchor" },
          { label: "windowed", address: "Windowed Flexible" },
          { label: "end", address: "End" },
        ],
        40 * 60,
        [
          ["start", "fixed", 10 * 60],
          ["start", "windowed", 2 * 60],
          ["windowed", "fixed", 15 * 60],
          ["fixed", "windowed", 60 * 60],
          ["fixed", "end", 5 * 60],
          ["windowed", "end", 5 * 60],
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
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
            visitId: "visit-fixed-anchor-slack-guard",
            patientId: "patient-fixed-anchor-slack-guard",
            patientName: "Fixed Anchor",
            address: "Fixed Anchor",
            windowStart: "09:00",
            windowEnd: "10:00",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-windowed-flex-slack-guard",
            patientId: "patient-windowed-flex-slack-guard",
            patientName: "Windowed Flexible",
            address: "Windowed Flexible",
            windowStart: "08:00",
            windowEnd: "16:00",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
      {
        requestId: "guard-refine-windowed-flex",
        nurseId: "nurse-refine-windowed-flex",
        shadowCompare: false,
      },
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Fixed Anchor", "Windowed Flexible"]);

    const fixedTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-fixed-anchor-slack-guard");
    expect(fixedTask?.lateBySeconds).toBe(0);
    expect(fixedTask?.serviceStartTime).toBe("2026-03-13T13:00:00.000Z");
  });

  it("produces identical ordering across repeated runs when requestId is the same", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "D", coords: { lat: 43.64, lon: -79.64 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildDenseTravelMatrix(
        ["Start", "A", "B", "C", "D", "End"],
        [
          2366, 654, 2046, 958, 2373, 1072, 1051, 1312, 664, 600, 2022, 2458, 2328, 1315, 234, 2415,
          2107, 524, 1785, 1209, 233, 1494, 2374, 1812, 1218, 1616, 841, 1500, 315, 2075,
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const request = {
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
          patientName: "A",
          address: "A",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 20,
        },
        {
          visitId: "visit-b",
          patientId: "patient-b",
          patientName: "B",
          address: "B",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 21,
        },
        {
          visitId: "visit-c",
          patientId: "patient-c",
          patientName: "C",
          address: "C",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 22,
        },
        {
          visitId: "visit-d",
          patientId: "patient-d",
          patientName: "D",
          address: "D",
          windowStart: "",
          windowEnd: "",
          windowType: "flexible" as const,
          serviceDurationMinutes: 23,
        },
      ],
      optimizationObjective: "distance" as const,
    };

    const runWithSeed = () =>
      optimizeRouteV3(request, "google-key", {
        requestId: "deterministic-seed-1",
        nurseId: "nurse-1",
        shadowCompare: false,
      });

    const first = await runWithSeed();
    const second = await runWithSeed();

    const firstOrder = first.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .flatMap((stop) => stop.tasks.map((task) => task.visitId));
    const secondOrder = second.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .flatMap((stop) => stop.tasks.map((task) => task.visitId));

    expect(secondOrder).toEqual(firstOrder);
  });

  it("does not call Math.random during seeded ILS perturbations", async () => {
    const randomSpy = vi.spyOn(Math, "random");

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "A", coords: { lat: 43.61, lon: -79.61 } },
      { address: "B", coords: { lat: 43.62, lon: -79.62 } },
      { address: "C", coords: { lat: 43.63, lon: -79.63 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(
        [
          { label: "start", address: "Start" },
          { label: "a", address: "A" },
          { label: "b", address: "B" },
          { label: "c", address: "C" },
          { label: "end", address: "End" },
        ],
        20 * 60,
        [
          ["start", "a", 6 * 60],
          ["start", "b", 7 * 60],
          ["start", "c", 8 * 60],
          ["a", "b", 5 * 60],
          ["b", "c", 5 * 60],
          ["c", "a", 5 * 60],
          ["a", "end", 5 * 60],
          ["b", "end", 5 * 60],
          ["c", "end", 5 * 60],
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    await optimizeRouteV3(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T08:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-a-seeded-rng",
            patientId: "patient-a-seeded-rng",
            patientName: "A",
            address: "A",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-b-seeded-rng",
            patientId: "patient-b-seeded-rng",
            patientName: "B",
            address: "B",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
          {
            visitId: "visit-c-seeded-rng",
            patientId: "patient-c-seeded-rng",
            patientName: "C",
            address: "C",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 20,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
      {
        requestId: "seed-rng-no-math-random",
        nurseId: "nurse-rng-no-math-random",
        shadowCompare: false,
      },
    );

    expect(randomSpy).not.toHaveBeenCalled();
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

    await optimizeRouteV3(
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

    await optimizeRouteV3(
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
        optimizationObjective: "time",
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

  it("can move a no-window visit ahead of a late fixed anchor when that reduces fixed lateness", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Late Address", coords: { lat: 43.7, lon: -79.7 } },
      { address: "Shortcut No-Window", coords: { lat: 43.601, lon: -79.601 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:fixed late address", 3600],
        ["address:start", "address:shortcut no-window", 300],
        ["address:shortcut no-window", "address:fixed late address", 60],
        ["address:fixed late address", "address:shortcut no-window", 3600],
        ["address:fixed late address", "address:end", 600],
        ["address:shortcut no-window", "address:end", 3600],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Shortcut No-Window",
          coords: orderedStops[0]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.5,
          durationFromPreviousSeconds: 300,
        },
        {
          address: orderedStops[1]?.address ?? "Fixed Late Address",
          coords: orderedStops[1]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "End",
          coords: orderedStops[2]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          distanceMeters: 500,
          durationSeconds: 300,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Shortcut No-Window",
          toAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "Fixed Late Address",
          toAddress: orderedStops[2]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 600,
          encodedPolyline: "c",
        },
      ],
      totalDistanceMeters: 1600,
      totalDistanceKm: 1.6,
      totalDurationSeconds: 960,
    }));

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-fixed-late",
            patientId: "patient-fixed-late",
            patientName: "Fixed Late",
            address: "Fixed Late Address",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-shortcut",
            patientId: "patient-shortcut",
            patientName: "Shortcut",
            address: "Shortcut No-Window",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 5,
          },
        ],
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Shortcut No-Window", "Fixed Late Address"]);

    const fixedTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === "visit-fixed-late");
    expect(fixedTask?.lateBySeconds).toBe(0);
  });

  it("accepts late-fixed recovery ordering when it improves fixed lateness", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed Late A", coords: { lat: 43.7, lon: -79.7 } },
      { address: "No Window Shortcut", coords: { lat: 43.601, lon: -79.601 } },
      { address: "Fixed Buffer B", coords: { lat: 43.72, lon: -79.72 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(
        [
          { label: "start", address: "Start" },
          { label: "fixed-a", address: "Fixed Late A" },
          { label: "no-window", address: "No Window Shortcut" },
          { label: "fixed-b", address: "Fixed Buffer B" },
          { label: "end", address: "End" },
        ],
        40 * 60,
        [
          ["start", "fixed-a", 40 * 60],
          ["start", "no-window", 5 * 60],
          ["start", "fixed-b", 60 * 60],
          ["fixed-a", "no-window", 60],
          ["no-window", "fixed-a", 5 * 60],
          ["no-window", "fixed-b", 60],
          ["fixed-a", "fixed-b", 40 * 60],
          ["fixed-b", "fixed-a", 40 * 60],
          ["fixed-b", "no-window", 60],
          ["fixed-a", "end", 10 * 60],
          ["no-window", "end", 10 * 60],
          ["fixed-b", "end", 10 * 60],
        ],
      ),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-fixed-a",
            patientId: "patient-fixed-a",
            patientName: "Fixed Late A",
            address: "Fixed Late A",
            windowStart: "09:00",
            windowEnd: "09:30",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
          {
            visitId: "visit-no-window-shortcut",
            patientId: "patient-no-window-shortcut",
            patientName: "No Window Shortcut",
            address: "No Window Shortcut",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 5,
          },
          {
            visitId: "visit-fixed-b",
            patientId: "patient-fixed-b",
            patientName: "Fixed Buffer B",
            address: "Fixed Buffer B",
            windowStart: "10:00",
            windowEnd: "11:00",
            windowType: "fixed",
            serviceDurationMinutes: 15,
          },
        ],
        optimizationObjective: "distance",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["No Window Shortcut", "Fixed Late A", "Fixed Buffer B"]);
  });

  it("does not move a no-window visit ahead of a fixed anchor when fixedLateCount would worsen", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start", coords: { lat: 43.6, lon: -79.6 } },
      { address: "Fixed A", coords: { lat: 43.7, lon: -79.7 } },
      { address: "No Window", coords: { lat: 43.601, lon: -79.601 } },
      { address: "Fixed B", coords: { lat: 43.72, lon: -79.72 } },
      { address: "End", coords: { lat: 43.8, lon: -79.8 } },
    ]);

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrix([
        ["address:start", "address:fixed a", 20 * 60],
        ["address:start", "address:no window", 10 * 60],
        ["address:start", "address:fixed b", 60 * 60],
        ["address:fixed a", "address:no window", 60],
        ["address:no window", "address:fixed a", 60],
        ["address:fixed a", "address:fixed b", 20 * 60],
        ["address:fixed b", "address:fixed a", 20 * 60],
        ["address:no window", "address:fixed b", 60],
        ["address:fixed b", "address:no window", 60],
        ["address:fixed a", "address:end", 10 * 60],
        ["address:no window", "address:end", 10 * 60],
        ["address:fixed b", "address:end", 10 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) => ({
      orderedStops: [
        {
          address: orderedStops[0]?.address ?? "Fixed A",
          coords: orderedStops[0]?.coords ?? { lat: 43.7, lon: -79.7 },
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 20 * 60,
        },
        {
          address: orderedStops[1]?.address ?? "No Window",
          coords: orderedStops[1]?.coords ?? { lat: 43.601, lon: -79.601 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[2]?.address ?? "Fixed B",
          coords: orderedStops[2]?.coords ?? { lat: 43.72, lon: -79.72 },
          distanceFromPreviousKm: 0.1,
          durationFromPreviousSeconds: 60,
        },
        {
          address: orderedStops[3]?.address ?? "End",
          coords: orderedStops[3]?.coords ?? { lat: 43.8, lon: -79.8 },
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 10 * 60,
          isEndingPoint: true,
        },
      ],
      routeLegs: [
        {
          fromAddress: "Start",
          toAddress: orderedStops[0]?.address ?? "Fixed A",
          distanceMeters: 2000,
          durationSeconds: 20 * 60,
          encodedPolyline: "a",
        },
        {
          fromAddress: orderedStops[0]?.address ?? "Fixed A",
          toAddress: orderedStops[1]?.address ?? "No Window",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "b",
        },
        {
          fromAddress: orderedStops[1]?.address ?? "No Window",
          toAddress: orderedStops[2]?.address ?? "Fixed B",
          distanceMeters: 100,
          durationSeconds: 60,
          encodedPolyline: "c",
        },
        {
          fromAddress: orderedStops[2]?.address ?? "Fixed B",
          toAddress: orderedStops[3]?.address ?? "End",
          distanceMeters: 1000,
          durationSeconds: 10 * 60,
          encodedPolyline: "d",
        },
      ],
      totalDistanceMeters: 3200,
      totalDistanceKm: 3.2,
      totalDurationSeconds: 22 * 60,
    }));

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-13",
        timezone: "America/Toronto",
        start: {
          address: "Start",
          departureTime: "2026-03-13T09:00:00-04:00",
        },
        end: {
          address: "End",
        },
        visits: [
          {
            visitId: "visit-fixed-a",
            patientId: "patient-fixed-a",
            patientName: "Fixed A",
            address: "Fixed A",
            windowStart: "09:00",
            windowEnd: "09:10",
            windowType: "fixed",
            serviceDurationMinutes: 5,
          },
          {
            visitId: "visit-no-window",
            patientId: "patient-no-window",
            patientName: "No Window",
            address: "No Window",
            windowStart: "",
            windowEnd: "",
            windowType: "flexible",
            serviceDurationMinutes: 1,
          },
          {
            visitId: "visit-fixed-b",
            patientId: "patient-fixed-b",
            patientName: "Fixed B",
            address: "Fixed B",
            windowStart: "09:20",
            windowEnd: "09:32",
            windowType: "fixed",
            serviceDurationMinutes: 5,
          },
        ],
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    expect(stopAddresses).toEqual(["Fixed A", "No Window", "Fixed B"]);

    const fixedTasks = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .filter((task) => task.windowType === "fixed");
    const fixedLateCount = fixedTasks.filter((task) => task.lateBySeconds > 0).length;
    expect(fixedLateCount).toBe(2);
  });

  it("keeps the real Mississauga payload cluster scheduled before Ian's fixed noon visit and keeps both fixed visits on time", async () => {
    const startAddress = "3361 Ingram Road, Mississauga, ON";
    const shanaaz = {
      visitId: "visit-2-18beff0e-765c-4796-8e9f-f1ad81f0b030",
      patientId: "18beff0e-765c-4796-8e9f-f1ad81f0b030",
      patientName: "Shanaaz Haffejee",
      address: "6260 Montevideo Road #71, Mississauga, ON",
      googlePlaceId:
        "Eik2MjYwIE1vbnRldmlkZW8gUm9hZCAjNzEsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJB70mCnFqK4gRlEM7WewvfgMSAjcx",
      windowStart: "08:00",
      windowEnd: "08:35",
      windowType: "fixed" as const,
      serviceDurationMinutes: 35,
    };
    const nasim = {
      visitId: "visit-5-9ebfde78-2994-4cb7-9ae6-653b9f9a5cf3",
      patientId: "9ebfde78-2994-4cb7-9ae6-653b9f9a5cf3",
      patientName: "Nasim Akhter",
      address: "5697 Glen Erin Drive, Mississauga, ON",
      googlePlaceId: "ChIJP9jDNuVBK4gRR8WwCjaaDsI",
      windowStart: "09:00",
      windowEnd: "11:00",
      windowType: "flexible" as const,
      serviceDurationMinutes: 15,
    };
    const dindyal = {
      visitId: "visit-6-dfab81f3-5066-4e41-9928-1f5fe6e1b60b",
      patientId: "dfab81f3-5066-4e41-9928-1f5fe6e1b60b",
      patientName: "Dindyal Bachan",
      address: "3435 Jorie Crescent, Mississauga, ON",
      googlePlaceId: "ChIJ3yjQz_tpK4gRMFMNcrl1wNw",
      windowStart: "08:30",
      windowEnd: "13:00",
      windowType: "flexible" as const,
      serviceDurationMinutes: 20,
    };
    const catherine = {
      visitId: "visit-7-93c51a70-d09a-4035-af7b-d1c6a542b484",
      patientId: "93c51a70-d09a-4035-af7b-d1c6a542b484",
      patientName: "Catherine Nguemelieu Epse Djom",
      address: "7030 Copenhagen Road #10, Mississauga, ON",
      googlePlaceId:
        "Eik3MDMwIENvcGVuaGFnZW4gUm9hZCAjMTAsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJSZT5Y15qK4gRIcXZ70LBabISAjEw",
      windowStart: "",
      windowEnd: "",
      windowType: "flexible" as const,
      serviceDurationMinutes: 15,
    };
    const ian = {
      visitId: "visit-11-bb7c13cd-5bc8-48ad-8b05-633ee8e1e60b",
      patientId: "bb7c13cd-5bc8-48ad-8b05-633ee8e1e60b",
      patientName: "Ian Mcadam",
      address: "6424 Millers Grove, Mississauga, ON",
      googlePlaceId: "ChIJASXyVhZqK4gRHSwa1GJWiq4",
      windowStart: "12:10",
      windowEnd: "12:30",
      windowType: "fixed" as const,
      serviceDurationMinutes: 20,
    };

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.58, lon: -79.71 } },
      { address: shanaaz.address, coords: { lat: 43.61, lon: -79.74 } },
      { address: nasim.address, coords: { lat: 43.58, lon: -79.73 } },
      { address: dindyal.address, coords: { lat: 43.6, lon: -79.72 } },
      { address: catherine.address, coords: { lat: 43.62, lon: -79.76 } },
      { address: ian.address, coords: { lat: 43.61, lon: -79.75 } },
      { address: startAddress, coords: { lat: 43.58, lon: -79.71 } },
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      { label: "shanaaz", address: shanaaz.address, googlePlaceId: shanaaz.googlePlaceId },
      { label: "nasim", address: nasim.address, googlePlaceId: nasim.googlePlaceId },
      { label: "dindyal", address: dindyal.address, googlePlaceId: dindyal.googlePlaceId },
      { label: "catherine", address: catherine.address, googlePlaceId: catherine.googlePlaceId },
      { label: "ian", address: ian.address, googlePlaceId: ian.googlePlaceId },
      { label: "end", address: startAddress },
    ];

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "shanaaz", 5 * 60],
        ["shanaaz", "nasim", 10 * 60],
        ["shanaaz", "dindyal", 8 * 60],
        ["shanaaz", "catherine", 6 * 60],
        ["shanaaz", "ian", 15 * 60],
        ["nasim", "dindyal", 6 * 60],
        ["nasim", "catherine", 9 * 60],
        ["nasim", "ian", 10 * 60],
        ["dindyal", "nasim", 6 * 60],
        ["dindyal", "catherine", 6 * 60],
        ["dindyal", "ian", 8 * 60],
        ["catherine", "nasim", 9 * 60],
        ["catherine", "dindyal", 6 * 60],
        ["catherine", "ian", 7 * 60],
        ["ian", "end", 20 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-24",
        timezone: "America/Toronto",
        start: {
          address: startAddress,
        },
        end: {
          address: startAddress,
        },
        visits: [shanaaz, nasim, dindyal, catherine, ian],
        nurseWorkingHours: {
          workStart: "08:00",
          workEnd: "16:00",
        },
        optimizationObjective: "time",
      },
      "google-key",
    );

    const stopAddresses = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.address);
    const nasimIndex = stopAddresses.indexOf(nasim.address);
    const dindyalIndex = stopAddresses.indexOf(dindyal.address);
    const catherineIndex = stopAddresses.indexOf(catherine.address);
    const ianIndex = stopAddresses.indexOf(ian.address);

    expect(stopAddresses[0]).toBe(shanaaz.address);
    expect(nasimIndex).toBeGreaterThan(-1);
    expect(dindyalIndex).toBeGreaterThan(-1);
    expect(catherineIndex).toBeGreaterThan(-1);
    expect(ianIndex).toBeGreaterThan(-1);
    expect(nasimIndex).toBeLessThan(ianIndex);
    expect(dindyalIndex).toBeLessThan(ianIndex);
    expect(catherineIndex).toBeLessThan(ianIndex);

    const shanaazTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === shanaaz.visitId);
    const ianTask = result.orderedStops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.visitId === ian.visitId);

    expect(shanaazTask?.lateBySeconds).toBe(0);
    expect(ianTask?.lateBySeconds).toBe(0);
  });

  it("moves Nasim ahead of Ian on the issue-derived Mississauga matrix and eliminates the late flexible-window penalty", async () => {
    const startAddress = "3361 Ingram Road, Mississauga, ON";
    const visits = [
      {
        label: "isabelle",
        visitId: "visit-1",
        patientId: "1",
        patientName: "Isabelle Longlade",
        address: "2869 Battleford Road #3211, Mississauga, ON",
        googlePlaceId:
          "EisyODY5IEJhdHRsZWZvcmQgUm9hZCAjMzIxMSwgTWlzc2lzc2F1Z2EsIE9OIiAaHgoWChQKEglfRmlxbGoriBF5sTEBYKcW1xIEMzIxMQ",
        windowStart: "10:00",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "shanaaz",
        visitId: "visit-2",
        patientId: "2",
        patientName: "Shanaaz Haffejee",
        address: "6260 Montevideo Road #71, Mississauga, ON",
        googlePlaceId:
          "Eik2MjYwIE1vbnRldmlkZW8gUm9hZCAjNzEsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJB70mCnFqK4gRlEM7WewvfgMSAjcx",
        windowStart: "08:00",
        windowEnd: "08:35",
        windowType: "fixed" as const,
        serviceDurationMinutes: 35,
      },
      {
        label: "ernst",
        visitId: "visit-3",
        patientId: "3",
        patientName: "Ernst Vonarburg",
        address: "6043 Tenth Line West, Mississauga, ON",
        googlePlaceId: "ChIJzVfrsgRqK4gRRT3NFPmVuz0",
        windowStart: "08:30",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "gary",
        visitId: "visit-4",
        patientId: "4",
        patientName: "Gary Frauts",
        address: "3276 Forrestdale Circle, Mississauga, ON",
        googlePlaceId: "ChIJJ7F2FDhqK4gRiBLQ5LdJTfw",
        windowStart: "08:30",
        windowEnd: "10:30",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "nasim",
        visitId: "visit-5",
        patientId: "5",
        patientName: "Nasim Akhter",
        address: "5697 Glen Erin Drive, Mississauga, ON",
        googlePlaceId: "ChIJP9jDNuVBK4gRR8WwCjaaDsI",
        windowStart: "09:00",
        windowEnd: "11:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "dindyal",
        visitId: "visit-6",
        patientId: "6",
        patientName: "Dindyal Bachan",
        address: "3435 Jorie Crescent, Mississauga, ON",
        googlePlaceId: "ChIJ3yjQz_tpK4gRMFMNcrl1wNw",
        windowStart: "08:30",
        windowEnd: "13:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "catherine",
        visitId: "visit-7",
        patientId: "7",
        patientName: "Catherine Nguemelieu Epse Djom",
        address: "7030 Copenhagen Road #10, Mississauga, ON",
        googlePlaceId:
          "Eik3MDMwIENvcGVuaGFnZW4gUm9hZCAjMTAsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJSZT5Y15qK4gRIcXZ70LBabISAjEw",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "kefeng",
        visitId: "visit-8",
        patientId: "8",
        patientName: "Kefeng Zhou",
        address: "3163 Southwind Rd, Mississauga, ON",
        googlePlaceId: "ChIJbYdjkQNCK4gRjQccEPflk9c",
        windowStart: "12:30",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
      {
        label: "mildred",
        visitId: "visit-9",
        patientId: "9",
        patientName: "Mildred Wheatley",
        address: "66 Rutledge Road, Mississauga, ON",
        googlePlaceId: "ChIJMyj7ScZBK4gRgwYsvxtR8hw",
        windowStart: "10:00",
        windowEnd: "11:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "hsiu",
        visitId: "visit-10",
        patientId: "10",
        patientName: "Hsiu-mei Lin",
        address: "92 William St #101, Mississauga, ON",
        googlePlaceId:
          "EiM5MiBXaWxsaWFtIFN0ICMxMDEsIE1pc3Npc3NhdWdhLCBPTiIfGh0KFgoUChIJa0cVl8dBK4gRULmmjibhxw8SAzEwMQ",
        windowStart: "10:00",
        windowEnd: "15:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "ian",
        visitId: "visit-11",
        patientId: "11",
        patientName: "Ian Mcadam",
        address: "6424 Millers Grove, Mississauga, ON",
        googlePlaceId: "ChIJASXyVhZqK4gRHSwa1GJWiq4",
        windowStart: "12:10",
        windowEnd: "12:30",
        windowType: "fixed" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "cheryl",
        visitId: "visit-12",
        patientId: "12",
        patientName: "Cheryl Tower",
        address: "23 Bow River Crescent, Mississauga, ON",
        googlePlaceId: "ChIJaY019i1AK4gRlYsEyniT2nU",
        windowStart: "10:00",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
    ];

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.5271, lon: -79.7067 } },
      ...visits.map((visit, index) => ({
        address: visit.address,
        coords: { lat: 43.55 + index * 0.001, lon: -79.75 + index * 0.001 },
      })),
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      ...visits.map(({ label, address, googlePlaceId }) => ({ label, address, googlePlaceId })),
      { label: "end", address: startAddress },
    ];

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "shanaaz", 15 * 60],
        ["shanaaz", "ernst", 6 * 60],
        ["ernst", "dindyal", 4 * 60],
        ["dindyal", "gary", 9 * 60],
        ["gary", "catherine", 7 * 60],
        ["catherine", "hsiu", 10 * 60],
        ["hsiu", "mildred", 60],
        ["mildred", "cheryl", 6 * 60],
        ["cheryl", "ian", 11 * 60],
        ["ian", "nasim", 8 * 60],
        ["nasim", "isabelle", 7 * 60],
        ["isabelle", "kefeng", 7 * 60],
        ["gary", "ernst", 20 * 60],
        ["gary", "nasim", 5 * 60],
        ["dindyal", "nasim", 6 * 60],
        ["nasim", "mildred", 7 * 60],
        ["cheryl", "catherine", 9 * 60],
        ["catherine", "ian", 8 * 60],
        ["ian", "isabelle", 5 * 60],
        ["kefeng", "end", 9 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const request = {
      planningDate: "2026-03-24",
      timezone: "America/Toronto",
      start: { address: startAddress },
      end: { address: startAddress },
      visits: visits.map((visit) => {
        const visitWithoutLabel = { ...visit };
        delete (visitWithoutLabel as { label?: string }).label;
        return visitWithoutLabel;
      }),
      nurseWorkingHours: { workStart: "08:00", workEnd: "16:00" },
      optimizationObjective: "time" as const,
    };

    const v2Result = await optimizeRouteV2(request, "google-key");
    const v3Result = await optimizeRouteV3(request, "google-key");
    const v3Order = v3Result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);
    const nasimIndex = v3Order.indexOf("Nasim Akhter");
    const ianIndex = v3Order.indexOf("Ian Mcadam");

    expect(nasimIndex).toBeGreaterThan(-1);
    expect(ianIndex).toBeGreaterThan(-1);
    expect(nasimIndex).toBeLessThan(ianIndex);
    expect(v3Result.metrics.totalLateSeconds).toBe(0);
    expect(v3Result.metrics.totalLateSeconds).toBeLessThan(v2Result.metrics.totalLateSeconds);
  });

  it("matches the amended Mississauga sequence through Cheryl and keeps the Ian tail aligned", async () => {
    const startAddress = "3361 Ingram Road, Mississauga, ON";
    const expectedOrder = [
      "Shanaaz Haffejee",
      "Gary Frauts",
      "Ernst Vonarburg",
      "Dindyal Bachan",
      "Nasim Akhter",
      "Mildred Wheatley",
      "Hsiu-mei Lin",
      "Cheryl Tower",
      "Catherine Nguemelieu Epse Djom",
      "Ian Mcadam",
      "Isabelle Longlade",
      "Kefeng Zhou",
    ];
    const visits = [
      {
        label: "shanaaz",
        visitId: "visit-1",
        patientId: "1",
        patientName: "Shanaaz Haffejee",
        address: "6260 Montevideo Road #71, Mississauga, ON",
        googlePlaceId:
          "Eik2MjYwIE1vbnRldmlkZW8gUm9hZCAjNzEsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJB70mCnFqK4gRlEM7WewvfgMSAjcx",
        windowStart: "08:00",
        windowEnd: "08:35",
        windowType: "fixed" as const,
        serviceDurationMinutes: 35,
      },
      {
        label: "gary",
        visitId: "visit-2",
        patientId: "2",
        patientName: "Gary Frauts",
        address: "3276 Forrestdale Circle, Mississauga, ON",
        googlePlaceId: "ChIJJ7F2FDhqK4gRiBLQ5LdJTfw",
        windowStart: "08:30",
        windowEnd: "10:30",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "ernst",
        visitId: "visit-3",
        patientId: "3",
        patientName: "Ernst Vonarburg",
        address: "6043 Tenth Line West, Mississauga, ON",
        googlePlaceId: "ChIJzVfrsgRqK4gRRT3NFPmVuz0",
        windowStart: "08:30",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "dindyal",
        visitId: "visit-4",
        patientId: "4",
        patientName: "Dindyal Bachan",
        address: "3435 Jorie Crescent, Mississauga, ON",
        googlePlaceId: "ChIJ3yjQz_tpK4gRMFMNcrl1wNw",
        windowStart: "08:30",
        windowEnd: "13:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "nasim",
        visitId: "visit-5",
        patientId: "5",
        patientName: "Nasim Akhter",
        address: "5697 Glen Erin Drive, Mississauga, ON",
        googlePlaceId: "ChIJP9jDNuVBK4gRR8WwCjaaDsI",
        windowStart: "09:00",
        windowEnd: "11:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "mildred",
        visitId: "visit-6",
        patientId: "6",
        patientName: "Mildred Wheatley",
        address: "66 Rutledge Road, Mississauga, ON",
        googlePlaceId: "ChIJMyj7ScZBK4gRgwYsvxtR8hw",
        windowStart: "10:00",
        windowEnd: "11:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "hsiu",
        visitId: "visit-7",
        patientId: "7",
        patientName: "Hsiu-mei Lin",
        address: "92 William St #101, Mississauga, ON",
        googlePlaceId:
          "EiM5MiBXaWxsaWFtIFN0ICMxMDEsIE1pc3Npc3NhdWdhLCBPTiIfGh0KFgoUChIJa0cVl8dBK4gRULmmjibhxw8SAzEwMQ",
        windowStart: "10:00",
        windowEnd: "15:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "cheryl",
        visitId: "visit-8",
        patientId: "8",
        patientName: "Cheryl Tower",
        address: "23 Bow River Crescent, Mississauga, ON",
        googlePlaceId: "ChIJaY019i1AK4gRlYsEyniT2nU",
        windowStart: "10:00",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
      {
        label: "catherine",
        visitId: "visit-9",
        patientId: "9",
        patientName: "Catherine Nguemelieu Epse Djom",
        address: "7030 Copenhagen Road #10, Mississauga, ON",
        googlePlaceId:
          "Eik3MDMwIENvcGVuaGFnZW4gUm9hZCAjMTAsIE1pc3Npc3NhdWdhLCBPTiIeGhwKFgoUChIJSZT5Y15qK4gRIcXZ70LBabISAjEw",
        windowStart: "",
        windowEnd: "",
        windowType: "flexible" as const,
        serviceDurationMinutes: 15,
      },
      {
        label: "ian",
        visitId: "visit-10",
        patientId: "10",
        patientName: "Ian Mcadam",
        address: "6424 Millers Grove, Mississauga, ON",
        googlePlaceId: "ChIJASXyVhZqK4gRHSwa1GJWiq4",
        windowStart: "12:10",
        windowEnd: "12:30",
        windowType: "fixed" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "isabelle",
        visitId: "visit-11",
        patientId: "11",
        patientName: "Isabelle Longlade",
        address: "2869 Battleford Road #3211, Mississauga, ON",
        googlePlaceId:
          "EisyODY5IEJhdHRsZWZvcmQgUm9hZCAjMzIxMSwgTWlzc2lzc2F1Z2EsIE9OIiAaHgoWChQKEglfRmlxbGoriBF5sTEBYKcW1xIEMzIxMQ",
        windowStart: "10:00",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 20,
      },
      {
        label: "kefeng",
        visitId: "visit-12",
        patientId: "12",
        patientName: "Kefeng Zhou",
        address: "3163 Southwind Rd, Mississauga, ON",
        googlePlaceId: "ChIJbYdjkQNCK4gRjQccEPflk9c",
        windowStart: "12:30",
        windowEnd: "16:00",
        windowType: "flexible" as const,
        serviceDurationMinutes: 30,
      },
    ];

    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: startAddress, coords: { lat: 43.5271, lon: -79.7067 } },
      ...visits.map((visit, index) => ({
        address: visit.address,
        coords: { lat: 43.55 + index * 0.001, lon: -79.75 + index * 0.001 },
      })),
    ]);

    const nodes = [
      { label: "start", address: startAddress },
      ...visits.map(({ label, address, googlePlaceId }) => ({ label, address, googlePlaceId })),
      { label: "end", address: startAddress },
    ];

    mockedBuildPlanningTravelDurationMatrix.mockResolvedValue(
      buildTravelMatrixByLabel(nodes, 45 * 60, [
        ["start", "shanaaz", 15 * 60],
        ["shanaaz", "gary", 7 * 60],
        ["gary", "ernst", 5 * 60],
        ["ernst", "dindyal", 4 * 60],
        ["dindyal", "nasim", 6 * 60],
        ["nasim", "mildred", 7 * 60],
        ["mildred", "hsiu", 60],
        ["hsiu", "cheryl", 6 * 60],
        ["cheryl", "catherine", 9 * 60],
        ["catherine", "ian", 8 * 60],
        ["ian", "isabelle", 5 * 60],
        ["isabelle", "kefeng", 7 * 60],
        ["kefeng", "end", 9 * 60],
        ["shanaaz", "ernst", 12 * 60],
        ["gary", "dindyal", 15 * 60],
        ["dindyal", "gary", 18 * 60],
        ["hsiu", "ian", 18 * 60],
        ["ian", "cheryl", 25 * 60],
        ["ian", "catherine", 20 * 60],
        ["catherine", "isabelle", 25 * 60],
      ]),
    );

    mockedBuildDrivingRoute.mockImplementation(async (_, orderedStops) =>
      buildDrivingRouteResult(orderedStops.map((stop) => stop.address)),
    );

    const result = await optimizeRouteV3(
      {
        planningDate: "2026-03-24",
        timezone: "America/Toronto",
        start: { address: startAddress },
        end: { address: startAddress },
        visits: visits.map((visit) => {
          const visitWithoutLabel = { ...visit };
          delete (visitWithoutLabel as { label?: string }).label;
          return visitWithoutLabel;
        }),
        nurseWorkingHours: { workStart: "08:00", workEnd: "16:00" },
        optimizationObjective: "time",
      },
      "google-key",
    );

    const actualOrder = result.orderedStops
      .filter((stop) => !stop.isEndingPoint)
      .map((stop) => stop.tasks[0]?.patientName ?? stop.address);

    expect(actualOrder.slice(0, 8)).toEqual(expectedOrder.slice(0, 8));
    expect(actualOrder.slice(-2)).toEqual(expectedOrder.slice(-2));
    expect(actualOrder.indexOf("Ian Mcadam")).toBeGreaterThan(actualOrder.indexOf("Cheryl Tower"));
    expect(actualOrder.indexOf("Ian Mcadam")).toBeLessThan(
      actualOrder.indexOf("Isabelle Longlade"),
    );
    expect(actualOrder.indexOf("Ian Mcadam")).toBeLessThan(actualOrder.indexOf("Kefeng Zhou"));
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    const result = await optimizeRouteV3(
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

    await optimizeRouteV3(
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
      optimizeRouteV3(
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
