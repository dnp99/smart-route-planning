import { HttpError } from "../../../lib/http";
import { geocodeAddressesSequentially, normalizeAddressKey } from "./geocoding";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";
import type { GeocodedStop, OptimizeRouteRequest, OptimizeRouteResult, LatLng } from "./types";

export const optimizeRoute = async (
  request: OptimizeRouteRequest,
  googleMapsApiKey: string,
): Promise<OptimizeRouteResult> => {
  const { startAddress, endAddress, addresses } = request;
  const startKey = normalizeAddressKey(startAddress);
  const endKey = normalizeAddressKey(endAddress);

  const destinationAddresses = addresses.filter((address) => {
    const normalized = normalizeAddressKey(address);
    return normalized !== startKey && normalized !== endKey;
  });

  const uniqueAddressesToGeocode: string[] = [];
  const seenAddressKeys = new Set<string>();

  [startAddress, ...destinationAddresses, endAddress].forEach((address) => {
    const key = normalizeAddressKey(address);
    if (!seenAddressKeys.has(key)) {
      seenAddressKeys.add(key);
      uniqueAddressesToGeocode.push(address);
    }
  });

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

  const geocodedStops: GeocodedStop[] = destinationAddresses.map((address) => ({
    address,
    coords: getCoordsOrThrow(address),
  }));

  const geocodedEnd: GeocodedStop = {
    address: endAddress,
    coords: getCoordsOrThrow(endAddress),
  };

  const orderedStops = computeNearestNeighborRoute(geocodedStart, geocodedStops, geocodedEnd);
  const optimized = await buildDrivingRoute(geocodedStart, orderedStops, googleMapsApiKey);

  return {
    start: geocodedStart,
    end: geocodedEnd,
    ...optimized,
  };
};
