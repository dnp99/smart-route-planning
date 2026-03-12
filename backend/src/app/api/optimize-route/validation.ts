import { HttpError } from "../../../lib/http";
import type { OptimizeRouteDestination, OptimizeRouteRequest } from "./types";

const MAX_DESTINATIONS = 25;
const MAX_ADDRESS_LENGTH = 200;

const normalizeAddressKey = (value: string) => value.trim().toLowerCase();

const trimOptionalString = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} must not be empty when provided.`);
  }

  return trimmed;
};

const parseOptionalStringOrNull = (value: unknown, fieldName: string): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDestination = (value: unknown, index: number): OptimizeRouteDestination => {
  if (typeof value !== "object" || value === null) {
    throw new HttpError(400, `destinations[${index}] must be a JSON object.`);
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.address !== "string") {
    throw new HttpError(400, `destinations[${index}].address must be a string.`);
  }

  const address = candidate.address.trim();
  if (!address) {
    throw new HttpError(400, `destinations[${index}].address is required.`);
  }

  if (address.length > MAX_ADDRESS_LENGTH) {
    throw new HttpError(
      400,
      `Each destination address must be at most ${MAX_ADDRESS_LENGTH} characters.`,
    );
  }

  const patientId = trimOptionalString(candidate.patientId, `destinations[${index}].patientId`);
  const patientName = trimOptionalString(candidate.patientName, `destinations[${index}].patientName`);

  const includesPatientMetadata = patientId !== undefined || patientName !== undefined;
  if (includesPatientMetadata && (patientId === undefined || patientName === undefined)) {
    throw new HttpError(
      400,
      `destinations[${index}] must include both patientId and patientName when patient metadata is provided.`,
    );
  }

  const googlePlaceId = parseOptionalStringOrNull(
    candidate.googlePlaceId,
    `destinations[${index}].googlePlaceId`,
  );

  return {
    address,
    patientId,
    patientName,
    googlePlaceId,
  };
};

const normalizeLegacyAddresses = (addresses: string[]) => {
  const normalizedDestinations: OptimizeRouteDestination[] = [];
  const seen = new Set<string>();

  for (const rawAddress of addresses) {
    const address = rawAddress.trim();
    if (!address) {
      continue;
    }

    const key = normalizeAddressKey(address);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedDestinations.push({
      address,
      googlePlaceId: null,
    });
  }

  return normalizedDestinations;
};

const normalizeDestinations = (destinations: OptimizeRouteDestination[]) => {
  const normalizedDestinations: OptimizeRouteDestination[] = [];
  const seen = new Set<string>();

  for (const destination of destinations) {
    const dedupeKey = destination.patientId
      ? `patient:${destination.patientId}`
      : `address:${normalizeAddressKey(destination.address)}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalizedDestinations.push(destination);
  }

  return normalizedDestinations;
};

export type ValidatedOptimizeRouteRequest = {
  startAddress: string;
  endAddress: string;
  destinations: OptimizeRouteDestination[];
};

export const parseAndValidateBody = (body: unknown): ValidatedOptimizeRouteRequest => {
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

  const startAddress = payload.startAddress.trim();
  const endAddress = payload.endAddress.trim();

  const hasAddresses = payload.addresses !== undefined;
  const hasDestinations = payload.destinations !== undefined;

  if (!hasAddresses && !hasDestinations) {
    throw new HttpError(400, "Either addresses or destinations is required.");
  }

  if (hasAddresses && hasDestinations) {
    throw new HttpError(400, "Provide either addresses or destinations, but not both.");
  }

  let destinations: OptimizeRouteDestination[];
  if (hasDestinations) {
    if (!Array.isArray(payload.destinations)) {
      throw new HttpError(400, "destinations must be an array.");
    }

    destinations = normalizeDestinations(payload.destinations.map((destination, index) => parseDestination(destination, index)));
  } else {
    if (!Array.isArray(payload.addresses) || payload.addresses.some((item) => typeof item !== "string")) {
      throw new HttpError(400, "addresses must be an array of strings.");
    }

    destinations = normalizeLegacyAddresses(payload.addresses);
  }

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

  if (destinations.length > MAX_DESTINATIONS) {
    throw new HttpError(400, `Please provide at most ${MAX_DESTINATIONS} destinations.`);
  }

  const hasOverlongAddress = destinations.some((destination) => destination.address.length > MAX_ADDRESS_LENGTH);
  if (hasOverlongAddress) {
    throw new HttpError(400, `Each destination address must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }

  return {
    startAddress,
    endAddress,
    destinations,
  };
};
