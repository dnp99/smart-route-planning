import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";
import type { GeocodedStop, OrderedStop } from "./types";

vi.mock("./geocoding", () => ({
  geocodeTargetsSequentially: vi.fn(),
  normalizeAddressKey: (address: string) => address.trim().toLowerCase(),
}));

vi.mock("./routing", () => ({
  computeNearestNeighborRoute: vi.fn(),
  buildDrivingRoute: vi.fn(),
}));

import { geocodeTargetsSequentially } from "./geocoding";
import { optimizeRoute } from "./optimizeRouteService";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";

const mockedGeocodeTargetsSequentially = vi.mocked(geocodeTargetsSequentially);
const mockedComputeNearestNeighborRoute = vi.mocked(computeNearestNeighborRoute);
const mockedBuildDrivingRoute = vi.mocked(buildDrivingRoute);

describe("optimizeRoute service", () => {
  beforeEach(() => {
    mockedGeocodeTargetsSequentially.mockReset();
    mockedComputeNearestNeighborRoute.mockReset();
    mockedBuildDrivingRoute.mockReset();
  });

  it("shapes final response and deduplicates geocoding inputs", async () => {
    const request = {
      startAddress: "Start Address",
      endAddress: "End Address",
      destinations: [
        {
          address: "Stop A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          googlePlaceId: "place-1",
        },
        {
          address: "END ADDRESS",
          patientId: "patient-end",
          patientName: "End Patient",
          googlePlaceId: "place-end",
        },
      ],
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
        patientId: "patient-1",
        patientName: "Jane Doe",
        googlePlaceId: "place-1",
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

    mockedGeocodeTargetsSequentially.mockResolvedValue(geocodedLookups);
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

    expect(mockedGeocodeTargetsSequentially).toHaveBeenCalledWith(
      [
        { address: "Start Address" },
        { address: "Stop A", googlePlaceId: "place-1" },
        { address: "End Address", googlePlaceId: "place-end" },
      ],
      "google-key",
    );
    expect(mockedComputeNearestNeighborRoute).toHaveBeenCalled();
    expect(mockedBuildDrivingRoute).toHaveBeenCalled();

    expect(result).toEqual({
      start: { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
      end: {
        address: "End Address",
        coords: { lat: 43.3, lon: -79.3 },
        patientId: "patient-end",
        patientName: "End Patient",
        googlePlaceId: "place-end",
      },
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

  it("uses manual start and end place ids for geocoding when provided", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
      { address: "End Address", coords: { lat: 43.3, lon: -79.3 } },
    ]);
    mockedComputeNearestNeighborRoute.mockReturnValue([]);
    mockedBuildDrivingRoute.mockResolvedValue({
      orderedStops: [],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    });

    await optimizeRoute(
      {
        startAddress: "Start Address",
        startGooglePlaceId: "start-place",
        endAddress: "End Address",
        endGooglePlaceId: "end-place",
        destinations: [],
      },
      "google-key",
    );

    expect(mockedGeocodeTargetsSequentially).toHaveBeenCalledWith(
      [
        { address: "Start Address", googlePlaceId: "start-place" },
        { address: "End Address", googlePlaceId: "end-place" },
      ],
      "google-key",
    );
  });

  it("throws HttpError when geocoding lookup is incomplete", async () => {
    mockedGeocodeTargetsSequentially.mockResolvedValue([
      { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
    ]);

    await expect(
      optimizeRoute(
        {
          startAddress: "Start Address",
          endAddress: "End Address",
          destinations: [
            {
              patientId: "patient-1",
              patientName: "Jane Doe",
              address: "Stop A",
            },
          ],
        },
        "google-key",
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: "Route geocoding data is incomplete.",
    } satisfies Partial<HttpError>);
  });
});
