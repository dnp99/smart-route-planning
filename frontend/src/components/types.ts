export type Theme = 'light' | 'dark';

export type LatLng = {
  lat: number;
  lon: number;
};

export type GeocodedStop = {
  address: string;
  coords: LatLng;
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

export type AddressSuggestion = {
  displayName: string;
  placeId: string;
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
