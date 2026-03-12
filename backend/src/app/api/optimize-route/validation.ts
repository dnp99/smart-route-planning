import { HttpError } from "../../../lib/http";
import type { OptimizeRouteDestination, OptimizeRouteRequest } from "./types";

const MAX_DESTINATIONS = 25;
const MAX_ADDRESS_LENGTH = 200;

const normalizeAddressKey = (value: string) => value.trim().toLowerCase();

const trimRequiredString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} is required.`);
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

  const patientId = trimRequiredString(candidate.patientId, `destinations[${index}].patientId`);
  const patientName = trimRequiredString(candidate.patientName, `destinations[${index}].patientName`);

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

  if (!Array.isArray(payload.destinations)) {
    throw new HttpError(400, "destinations must be an array.");
  }

  const destinations = normalizeDestinations(
    payload.destinations.map((destination, index) => parseDestination(destination, index)),
  );

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
