import { HttpError } from "../../../lib/http";
import type { OptimizeRouteRequest } from "./types";

const MAX_DESTINATIONS = 25;
const MAX_ADDRESS_LENGTH = 200;

const normalizeAddresses = (addresses: string[]) =>
  [...new Set(addresses.map((item) => item.trim()).filter(Boolean))];

export const parseAndValidateBody = (body: unknown): OptimizeRouteRequest => {
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
