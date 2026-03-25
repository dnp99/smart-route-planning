import { HttpError } from "../../../lib/http";
import type { GeocodedStop, LatLng } from "./types";

const GEOCODE_TIMEOUT_MS = 8000;
const DEFAULT_NOMINATIM_USER_AGENT = "careflow/1.0";

type GeocodeTarget = {
  address: string;
  googlePlaceId?: string | null;
};

type PlacesLocationPayload = {
  location?: {
    latitude?: unknown;
    longitude?: unknown;
  };
};

type PlacesTextSearchPayload = {
  places?: PlacesLocationPayload[];
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalizeAddressKey = (address: string) => address.trim().toLowerCase();

const resolveNominatimContactEmail = () => {
  const value = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
  return value && value.length > 0 ? value : undefined;
};

const parseCoords = (latitude: unknown, longitude: unknown): LatLng => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (lat !== lat || lon !== lon) {
    throw new HttpError(503, "Geocoding service returned invalid coordinates.");
  }

  return {
    lat,
    lon,
  };
};

const geocodeAddress = async (address: string): Promise<LatLng> => {
  const nominatimContactEmail = resolveNominatimContactEmail();
  const query = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ca",
  });
  if (nominatimContactEmail) {
    query.set("email", nominatimContactEmail);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEOCODE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: {
        "User-Agent": nominatimContactEmail
          ? `${DEFAULT_NOMINATIM_USER_AGENT} (${nominatimContactEmail})`
          : DEFAULT_NOMINATIM_USER_AGENT,
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
  return parseCoords(first.lat, first.lon);
};

const geocodeGooglePlaceId = async (placeId: string, apiKey: string): Promise<LatLng> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEOCODE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          Accept: "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "location",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );
  } catch {
    throw new HttpError(503, "Place lookup service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(500, "Google Places API key is invalid or not authorized.");
    }

    if (response.status === 429) {
      throw new HttpError(503, "Place lookup service is rate-limited. Please try again shortly.");
    }

    throw new HttpError(503, "Place lookup service returned an unexpected error.");
  }

  const payload = (await response.json()) as PlacesLocationPayload;

  if (!payload.location) {
    throw new HttpError(400, `Google Places lookup returned no location for place id: ${placeId}`);
  }

  return parseCoords(payload.location.latitude, payload.location.longitude);
};

const geocodeGoogleTextSearch = async (address: string, apiKey: string): Promise<LatLng> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEOCODE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({
        textQuery: address,
        regionCode: "CA",
        includedRegionCodes: ["CA"],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(503, "Place lookup service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(500, "Google Places API key is invalid or not authorized.");
    }

    if (response.status === 429) {
      throw new HttpError(503, "Place lookup service is rate-limited. Please try again shortly.");
    }

    throw new HttpError(503, "Place lookup service returned an unexpected error.");
  }

  const payload = (await response.json()) as PlacesTextSearchPayload;
  const location = payload.places?.[0]?.location;

  if (!location) {
    throw new HttpError(400, `Could not geocode address: ${address}`);
  }

  return parseCoords(location.latitude, location.longitude);
};

const geocodeTarget = async (target: GeocodeTarget, googleMapsApiKey: string): Promise<LatLng> => {
  const hasGoogleMapsApiKey = googleMapsApiKey.trim().length > 0;

  if (hasGoogleMapsApiKey && target.googlePlaceId) {
    try {
      return await geocodeGooglePlaceId(target.googlePlaceId, googleMapsApiKey);
    } catch {}
  }

  try {
    return await geocodeAddress(target.address);
  } catch (error) {
    if (!hasGoogleMapsApiKey) {
      throw error;
    }
  }

  return geocodeGoogleTextSearch(target.address, googleMapsApiKey);
};

export const geocodeTargetsSequentially = async (
  targets: GeocodeTarget[],
  googleMapsApiKey: string,
) => {
  const geocodedStops: GeocodedStop[] = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const coords = await geocodeTarget(target, googleMapsApiKey);
    geocodedStops.push({ address: target.address, coords });

    if (index < targets.length - 1) {
      await delay(1100);
    }
  }

  return geocodedStops;
};

export const geocodeAddressesSequentially = async (addresses: string[]) =>
  geocodeTargetsSequentially(
    addresses.map((address) => ({ address })),
    "",
  );
