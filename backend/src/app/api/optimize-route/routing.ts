import { HttpError } from "../../../lib/http";
import type { GeocodedStop, OrderedStop, RouteLeg, LatLng } from "./types";

const GOOGLE_ROUTES_TIMEOUT_MS = 10000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistanceKm = (from: LatLng, to: LatLng) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(fromLat) * Math.cos(toLat);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const computeNearestNeighborRoute = (
  start: GeocodedStop,
  stops: GeocodedStop[],
  end: GeocodedStop,
) => {
  const remaining = [...stops];
  const orderedStops: OrderedStop[] = [];
  let current = start;

  while (remaining.length > 0) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = haversineDistanceKm(current.coords, candidate.coords);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }

    const [nextStop] = remaining.splice(closestIndex, 1);
    orderedStops.push({
      ...nextStop,
      distanceFromPreviousKm: Number(closestDistance.toFixed(2)),
      durationFromPreviousSeconds: 0,
    });
    current = nextStop;
  }

  const distanceToEndKm = haversineDistanceKm(current.coords, end.coords);

  orderedStops.push({
    ...end,
    distanceFromPreviousKm: Number(distanceToEndKm.toFixed(2)),
    durationFromPreviousSeconds: 0,
    isEndingPoint: true,
  });

  return orderedStops;
};

const parseGoogleDurationSeconds = (duration: unknown) => {
  if (typeof duration !== "string" || !duration.endsWith("s")) {
    throw new HttpError(503, "Google Routes returned an invalid duration.");
  }

  const seconds = Number(duration.slice(0, -1));
  if (seconds !== seconds || !isFinite(seconds)) {
    throw new HttpError(503, "Google Routes returned an invalid duration.");
  }

  return Math.round(seconds);
};


const parseGoogleDistanceMeters = (distanceMeters: unknown) => {
  const value =
    typeof distanceMeters === "string" && distanceMeters.trim().length > 0
      ? Number(distanceMeters)
      : distanceMeters;

  if (typeof value !== "number" || value !== value || !isFinite(value)) {
    throw new HttpError(503, "Google Routes returned an invalid distance.");
  }

  return Math.round(value);
};

const fetchDrivingRouteLeg = async (
  from: GeocodedStop,
  to: GeocodedStop,
  apiKey: string,
): Promise<RouteLeg> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GOOGLE_ROUTES_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: from.coords.lat,
              longitude: from.coords.lon,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: to.coords.lat,
              longitude: to.coords.lon,
            },
          },
        },
        travelMode: "DRIVE",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(503, "Driving route service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(500, "Google Routes API key is invalid or not authorized.");
    }

    if (response.status === 429) {
      throw new HttpError(503, "Driving route service is rate-limited. Please try again shortly.");
    }

    throw new HttpError(503, "Driving route service returned an unexpected error.");
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: unknown;
      duration?: unknown;
      polyline?: {
        encodedPolyline?: unknown;
      };
    }>;
  };

  const firstRoute = payload.routes?.[0];
  if (!firstRoute) {
    throw new HttpError(503, "No driving route was found for one of the trip legs.");
  }

  const distanceMeters = parseGoogleDistanceMeters(firstRoute.distanceMeters);

  const encodedPolyline = firstRoute.polyline?.encodedPolyline;
  if (typeof encodedPolyline !== "string" || !encodedPolyline) {
    throw new HttpError(503, "Google Routes returned an invalid route path.");
  }

  return {
    fromAddress: from.address,
    toAddress: to.address,
    distanceMeters,
    durationSeconds: parseGoogleDurationSeconds(firstRoute.duration),
    encodedPolyline,
  };
};

export const buildDrivingRoute = async (
  start: GeocodedStop,
  orderedStops: OrderedStop[],
  apiKey: string,
) => {
  const routeLegs: RouteLeg[] = [];
  const updatedOrderedStops: OrderedStop[] = [];
  let previousStop = start;
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (const stop of orderedStops) {
    const leg = await fetchDrivingRouteLeg(previousStop, stop, apiKey);

    routeLegs.push(leg);
    updatedOrderedStops.push({
      ...stop,
      distanceFromPreviousKm: Number((leg.distanceMeters / 1000).toFixed(2)),
      durationFromPreviousSeconds: leg.durationSeconds,
    });

    totalDistanceMeters += leg.distanceMeters;
    totalDurationSeconds += leg.durationSeconds;
    previousStop = stop;
  }

  return {
    orderedStops: updatedOrderedStops,
    routeLegs,
    totalDistanceMeters,
    totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
    totalDurationSeconds,
  };
};
