import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";
import type { GeocodedStop, OrderedStop } from "./types";

vi.mock("./geocoding", () => ({
  geocodeAddressesSequentially: vi.fn(),
  normalizeAddressKey: (address: string) => address.trim().toLowerCase(),
}));

vi.mock("./routing", () => ({
  computeNearestNeighborRoute: vi.fn(),
  buildDrivingRoute: vi.fn(),
}));

import { geocodeAddressesSequentially } from "./geocoding";
import { optimizeRoute } from "./optimizeRouteService";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";

const mockedGeocodeAddressesSequentially = vi.mocked(geocodeAddressesSequentially);
const mockedComputeNearestNeighborRoute = vi.mocked(computeNearestNeighborRoute);
const mockedBuildDrivingRoute = vi.mocked(buildDrivingRoute);

describe("optimizeRoute service", () => {
  beforeEach(() => {
    mockedGeocodeAddressesSequentially.mockReset();
    mockedComputeNearestNeighborRoute.mockReset();
    mockedBuildDrivingRoute.mockReset();
  });

  it("shapes final response and deduplicates geocoding inputs", async () => {
    const request = {
      startAddress: "Start Address",
      endAddress: "End Address",
      addresses: ["Stop A", "start address", "END ADDRESS", "Stop A"],
    };

    const geocodedLookups: GeocodedStop[] = [
      { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
      { address: "Stop A", coords: { lat: 43.2, lon: -79.2 } },
      { address: "End Address", coords: { lat: 43.3, lon: -79.3 } },
    ];

    const orderedStops: OrderedStop[] = [
      {
        address: "Stop A",
        coords: { lat: 43.2, lon: -79.2 },
        distanceFromPreviousKm: 5,
        durationFromPreviousSeconds: 0,
      },
      {
        address: "End Address",
        coords: { lat: 43.3, lon: -79.3 },
        distanceFromPreviousKm: 6,
        durationFromPreviousSeconds: 0,
        isEndingPoint: true,
      },
    ];

    mockedGeocodeAddressesSequentially.mockResolvedValue(geocodedLookups);
    mockedComputeNearestNeighborRoute.mockReturnValue(orderedStops);
    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops,
      routeLegs: [
        {
          fromAddress: "Start Address",
          toAddress: "Stop A",
          distanceMeters: 5000,
          durationSeconds: 450,
          encodedPolyline: "abc",
        },
      ],
      totalDistanceMeters: 5000,
      totalDistanceKm: 5,
      totalDurationSeconds: 450,
    });

    const result = await optimizeRoute(request, "google-key");

    expect(mockedGeocodeAddressesSequentially).toHaveBeenCalledWith([
      "Start Address",
      "Stop A",
      "End Address",
    ]);
    expect(mockedComputeNearestNeighborRoute).toHaveBeenCalled();
    expect(mockedBuildDrivingRoute).toHaveBeenCalled();

    expect(result).toEqual({
      start: { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
      end: { address: "End Address", coords: { lat: 43.3, lon: -79.3 } },
      orderedStops,
      routeLegs: [
        {
          fromAddress: "Start Address",
          toAddress: "Stop A",
          distanceMeters: 5000,
          durationSeconds: 450,
          encodedPolyline: "abc",
        },
      ],
      totalDistanceMeters: 5000,
      totalDistanceKm: 5,
      totalDurationSeconds: 450,
    });
  });

  it("throws HttpError when geocoding lookup is incomplete", async () => {
    mockedGeocodeAddressesSequentially.mockResolvedValue([
      { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
    ]);

    await expect(
      optimizeRoute(
        {
          startAddress: "Start Address",
          endAddress: "End Address",
          addresses: [],
        },
        "google-key",
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: "Route geocoding data is incomplete.",
    } satisfies Partial<HttpError>);
  });
});
