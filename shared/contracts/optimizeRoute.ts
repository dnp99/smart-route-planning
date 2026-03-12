const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type LatLng = {
  lat: number;
  lon: number;
};

export type GeocodedStop = {
  address: string;
  coords: LatLng;
  patientId?: string;
  patientName?: string;
  googlePlaceId?: string | null;
};

export type OrderedStop = GeocodedStop & {
  distanceFromPreviousKm: number;
  durationFromPreviousSeconds: number;
  isEndingPoint?: boolean;
};

export type RouteLeg = {
  fromAddress: string;
  toAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

export type OptimizeRouteDestination = {
  address: string;
  patientId?: string;
  patientName?: string;
  googlePlaceId?: string | null;
};

export type OptimizeRouteRequest = {
  startAddress: string;
  endAddress: string;
  addresses?: string[];
  destinations?: OptimizeRouteDestination[];
};

export type OptimizeRouteResponse = {
  start: GeocodedStop;
  end: GeocodedStop;
  orderedStops: OrderedStop[];
  routeLegs: RouteLeg[];
  totalDistanceMeters: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
};

const isLatLng = (value: unknown): value is LatLng => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.lat === "number" && typeof value.lon === "number";
};

const isGeocodedStop = (value: unknown): value is GeocodedStop => {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.address !== "string" || !isLatLng(value.coords)) {
    return false;
  }

  if (value.patientId !== undefined && typeof value.patientId !== "string") {
    return false;
  }

  if (value.patientName !== undefined && typeof value.patientName !== "string") {
    return false;
  }

  if (value.googlePlaceId !== undefined && value.googlePlaceId !== null && typeof value.googlePlaceId !== "string") {
    return false;
  }

  return true;
};

const isOptimizeRouteDestination = (value: unknown): value is OptimizeRouteDestination => {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.address !== "string") {
    return false;
  }

  if (value.patientId !== undefined && typeof value.patientId !== "string") {
    return false;
  }

  if (value.patientName !== undefined && typeof value.patientName !== "string") {
    return false;
  }

  if (value.googlePlaceId !== undefined && value.googlePlaceId !== null && typeof value.googlePlaceId !== "string") {
    return false;
  }

  return true;
};

const isOrderedStop = (value: unknown): value is OrderedStop => {
  if (!isGeocodedStop(value)) {
    return false;
  }

  const candidate = value as GeocodedStop & Record<string, unknown>;

  if (
    typeof candidate.distanceFromPreviousKm !== "number" ||
    typeof candidate.durationFromPreviousSeconds !== "number"
  ) {
    return false;
  }

  if (candidate.isEndingPoint !== undefined && typeof candidate.isEndingPoint !== "boolean") {
    return false;
  }

  return true;
};

const isRouteLeg = (value: unknown): value is RouteLeg => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.fromAddress === "string" &&
    typeof value.toAddress === "string" &&
    typeof value.distanceMeters === "number" &&
    typeof value.durationSeconds === "number" &&
    typeof value.encodedPolyline === "string"
  );
};

export const isOptimizeRouteRequest = (payload: unknown): payload is OptimizeRouteRequest => {
  if (!isObject(payload)) {
    return false;
  }

  if (typeof payload.startAddress !== "string" || typeof payload.endAddress !== "string") {
    return false;
  }

  const hasAddresses = payload.addresses !== undefined;
  const hasDestinations = payload.destinations !== undefined;

  if (!hasAddresses && !hasDestinations) {
    return false;
  }

  if (hasAddresses && hasDestinations) {
    return false;
  }

  if (hasAddresses && (!Array.isArray(payload.addresses) || payload.addresses.some((value) => typeof value !== "string"))) {
    return false;
  }

  if (
    hasDestinations &&
    (!Array.isArray(payload.destinations) || payload.destinations.some((destination) => !isOptimizeRouteDestination(destination)))
  ) {
    return false;
  }

  return true;
};

export const parseOptimizeRouteResponse = (payload: unknown): OptimizeRouteResponse | null => {
  if (!isObject(payload)) {
    return null;
  }

  if (
    typeof payload.totalDistanceMeters !== "number" ||
    typeof payload.totalDistanceKm !== "number" ||
    typeof payload.totalDurationSeconds !== "number"
  ) {
    return null;
  }

  if (!isGeocodedStop(payload.start) || !isGeocodedStop(payload.end)) {
    return null;
  }

  if (!Array.isArray(payload.orderedStops) || !payload.orderedStops.every(isOrderedStop)) {
    return null;
  }

  if (!Array.isArray(payload.routeLegs) || !payload.routeLegs.every(isRouteLeg)) {
    return null;
  }

  return payload as OptimizeRouteResponse;
};
