import { HttpError } from "../../../lib/http";
import { geocodeTargetsSequentially, normalizeAddressKey } from "./geocoding";
import { buildDrivingRoute, computeNearestNeighborRoute } from "./routing";
import type { GeocodedStop, OptimizeRouteResult, LatLng } from "./types";
import type { ValidatedOptimizeRouteRequest } from "./validation";

export const optimizeRoute = async (
  request: ValidatedOptimizeRouteRequest,
  googleMapsApiKey: string,
): Promise<OptimizeRouteResult> => {
  const { startAddress, startGooglePlaceId, endAddress, endGooglePlaceId, destinations } = request;
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
  const resolvedEndGooglePlaceId = endDestination?.googlePlaceId ?? endGooglePlaceId;

  const uniqueGeocodeTargets: Array<{ address: string; googlePlaceId?: string | null }> = [];
  const geocodeTargetsByAddressKey = new Map<
    string,
    { address: string; googlePlaceId?: string | null }
  >();
  const geocodeTargets: Array<{ address: string; googlePlaceId?: string | null }> = [
    {
      address: startAddress,
      googlePlaceId: startGooglePlaceId,
    },
    ...destinationStops.map((destination) => ({
      address: destination.address,
      googlePlaceId: destination.googlePlaceId,
    })),
    {
      address: endAddress,
      googlePlaceId: resolvedEndGooglePlaceId,
    },
  ];

  geocodeTargets.forEach((target) => {
    const key = normalizeAddressKey(target.address);
    const existing = geocodeTargetsByAddressKey.get(key);

    if (!existing) {
      const nextTarget = target.googlePlaceId
        ? { address: target.address, googlePlaceId: target.googlePlaceId }
        : { address: target.address };
      geocodeTargetsByAddressKey.set(key, nextTarget);
      uniqueGeocodeTargets.push(nextTarget);
      return;
    }

    if (!existing.googlePlaceId && target.googlePlaceId) {
      existing.googlePlaceId = target.googlePlaceId;
    }
  });

  const geocodedLookups = await geocodeTargetsSequentially(uniqueGeocodeTargets, googleMapsApiKey);
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
    googlePlaceId: resolvedEndGooglePlaceId,
  };

  const orderedStops = computeNearestNeighborRoute(geocodedStart, geocodedStops, geocodedEnd);
  const optimized = await buildDrivingRoute(geocodedStart, orderedStops, googleMapsApiKey);

  return {
    start: geocodedStart,
    end: geocodedEnd,
    ...optimized,
  };
};
