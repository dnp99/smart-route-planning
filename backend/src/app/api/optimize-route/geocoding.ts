import { HttpError } from "../../../lib/http";
import type { GeocodedStop, LatLng } from "./types";

const GEOCODE_TIMEOUT_MS = 8000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalizeAddressKey = (address: string) => address.trim().toLowerCase();

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

export const geocodeAddressesSequentially = async (addresses: string[]) => {
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
