import { HttpError } from "../../../lib/http";
import { geocodeAddressesSequentially, normalizeAddressKey } from "./geocoding";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";
import type { GeocodedStop, OptimizeRouteResult, LatLng } from "./types";
import type { ValidatedOptimizeRouteRequest } from "./validation";

export const optimizeRoute = async (
  request: ValidatedOptimizeRouteRequest,
  googleMapsApiKey: string,
): Promise<OptimizeRouteResult> => {
  const { startAddress, endAddress, destinations } = request;
  const startKey = normalizeAddressKey(startAddress);
  const endKey = normalizeAddressKey(endAddress);
  const endDestination =
    [...destinations]
      .reverse()
      .find((destination) => normalizeAddressKey(destination.address) === endKey) ?? null;

  const destinationStops = destinations.filter((destination) => {
    const normalized = normalizeAddressKey(destination.address);
    return normalized !== startKey && normalized !== endKey;
  });

  const uniqueAddressesToGeocode: string[] = [];
  const seenAddressKeys = new Set<string>();

  [startAddress, ...destinationStops.map((destination) => destination.address), endAddress].forEach(
    (address) => {
      const key = normalizeAddressKey(address);
      if (!seenAddressKeys.has(key)) {
        seenAddressKeys.add(key);
        uniqueAddressesToGeocode.push(address);
      }
    },
  );

  const geocodedLookups = await geocodeAddressesSequentially(uniqueAddressesToGeocode);
  const geocodedByAddressKey = new Map<string, LatLng>();

  geocodedLookups.forEach((stop) => {
    geocodedByAddressKey.set(normalizeAddressKey(stop.address), stop.coords);
  });

  const getCoordsOrThrow = (address: string) => {
    const coords = geocodedByAddressKey.get(normalizeAddressKey(address));
    if (!coords) {
      throw new HttpError(500, "Route geocoding data is incomplete.");
    }

    return coords;
  };

  const geocodedStart: GeocodedStop = {
    address: startAddress,
    coords: getCoordsOrThrow(startAddress),
  };

  const geocodedStops: GeocodedStop[] = destinationStops.map((destination) => ({
    address: destination.address,
    coords: getCoordsOrThrow(destination.address),
    patientId: destination.patientId,
    patientName: destination.patientName,
    googlePlaceId: destination.googlePlaceId,
  }));

  const geocodedEnd: GeocodedStop = {
    address: endAddress,
    coords: getCoordsOrThrow(endAddress),
    patientId: endDestination?.patientId,
    patientName: endDestination?.patientName,
    googlePlaceId: endDestination?.googlePlaceId,
  };

  const orderedStops = computeNearestNeighborRoute(geocodedStart, geocodedStops, geocodedEnd);
  const optimized = await buildDrivingRoute(geocodedStart, orderedStops, googleMapsApiKey);

  return {
    start: geocodedStart,
    end: geocodedEnd,
    ...optimized,
  };
};
