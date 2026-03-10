import { NextResponse } from "next/server";

type LatLng = {
  lat: number;
  lon: number;
};

type GeocodedStop = {
  address: string;
  coords: LatLng;
};

type OrderedStop = GeocodedStop & {
  distanceFromPreviousKm: number;
  durationFromPreviousSeconds: number;
  isEndingPoint?: boolean;
};

type RouteLeg = {
  fromAddress: string;
  toAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

type OptimizeRouteRequest = {
  startAddress: string;
  endAddress: string;
  addresses: string[];
};

const MAX_DESTINATIONS = 25;
const MAX_ADDRESS_LENGTH = 200;
const GEOCODE_TIMEOUT_MS = 8000;
const GOOGLE_ROUTES_TIMEOUT_MS = 10000;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const resolveAllowedOrigin = (request: Request) => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configuredOrigins || configuredOrigins.length === 0) {
    return "*";
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && configuredOrigins.indexOf(requestOrigin) !== -1) {
    return requestOrigin;
  }

  return configuredOrigins[0];
};

const buildCorsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": resolveAllowedOrigin(request),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeAddressKey = (address: string) => address.trim().toLowerCase();

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

const geocodeAddress = async (address: string): Promise<LatLng> => {
  const query = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ca",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEOCODE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: {
        "User-Agent": "navigate-easy/1.0 (contact: support@navigate-easy.local)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(503, "Geocoding service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new HttpError(503, "Geocoding service is rate-limited. Please try again shortly.");
    }

    throw new HttpError(503, "Geocoding service returned an unexpected error.");
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;

  if (!Array.isArray(results) || results.length === 0) {
    throw new HttpError(400, `Could not geocode address: ${address}`);
  }

  const first = results[0];
  const lat = Number(first.lat);
  const lon = Number(first.lon);

  if (lat !== lat || lon !== lon) {
    throw new HttpError(503, "Geocoding service returned invalid coordinates.");
  }

  return {
    lat,
    lon,
  };
};

const geocodeAddressesSequentially = async (addresses: string[]) => {
  const geocodedStops: GeocodedStop[] = [];

  for (let index = 0; index < addresses.length; index += 1) {
    const address = addresses[index];
    const coords = await geocodeAddress(address);
    geocodedStops.push({ address, coords });

    if (index < addresses.length - 1) {
      await delay(1100);
    }
  }

  return geocodedStops;
};

const computeNearestNeighborRoute = (
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

  if (
    typeof firstRoute.distanceMeters !== "number" ||
    firstRoute.distanceMeters !== firstRoute.distanceMeters ||
    !isFinite(firstRoute.distanceMeters)
  ) {
    throw new HttpError(503, "Google Routes returned an invalid distance.");
  }

  const encodedPolyline = firstRoute.polyline?.encodedPolyline;
  if (typeof encodedPolyline !== "string" || !encodedPolyline) {
    throw new HttpError(503, "Google Routes returned an invalid route path.");
  }

  return {
    fromAddress: from.address,
    toAddress: to.address,
    distanceMeters: Math.round(firstRoute.distanceMeters),
    durationSeconds: parseGoogleDurationSeconds(firstRoute.duration),
    encodedPolyline,
  };
};

const buildDrivingRoute = async (
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

const normalizeAddresses = (addresses: string[]) =>
  [...new Set(addresses.map((item) => item.trim()).filter(Boolean))];

const parseAndValidateBody = (body: unknown): OptimizeRouteRequest => {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "Invalid request body.");
  }

  const payload = body as Partial<OptimizeRouteRequest>;

  if (typeof payload.startAddress !== "string") {
    throw new HttpError(400, "startAddress must be a string.");
  }

  if (typeof payload.endAddress !== "string") {
    throw new HttpError(400, "endAddress must be a string.");
  }

  if (!Array.isArray(payload.addresses) || payload.addresses.some((item) => typeof item !== "string")) {
    throw new HttpError(400, "addresses must be an array of strings.");
  }

  const startAddress = payload.startAddress.trim();
  const endAddress = payload.endAddress.trim();
  const addresses = normalizeAddresses(payload.addresses);

  if (!startAddress) {
    throw new HttpError(400, "Please provide a starting point.");
  }

  if (startAddress.length > MAX_ADDRESS_LENGTH) {
    throw new HttpError(400, `Starting point must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }

  if (!endAddress) {
    throw new HttpError(400, "Please provide an ending point.");
  }

  if (endAddress.length > MAX_ADDRESS_LENGTH) {
    throw new HttpError(400, `Ending point must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }

  if (addresses.length > MAX_DESTINATIONS) {
    throw new HttpError(400, `Please provide at most ${MAX_DESTINATIONS} destination addresses.`);
  }

  const hasOverlongAddress = addresses.some((address) => address.length > MAX_ADDRESS_LENGTH);
  if (hasOverlongAddress) {
    throw new HttpError(400, `Each destination must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }

  return {
    startAddress,
    endAddress,
    addresses,
  };
};

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request);

  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!googleMapsApiKey) {
      return NextResponse.json(
        { error: "Server is missing GOOGLE_MAPS_API_KEY configuration." },
        { status: 500, headers: corsHeaders },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { startAddress, endAddress, addresses } = parseAndValidateBody(body);
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

    return NextResponse.json(
      {
        start: geocodedStart,
        end: geocodedEnd,
        ...optimized,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { error: "Failed to optimize route." },
      { status: 500, headers: corsHeaders },
    );
  }
}
