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
  isEndingPoint?: boolean;
};

export type AddressSuggestion = {
  displayName: string;
  lat: number;
  lon: number;
};

export type OptimizeRouteResponse = {
  start: GeocodedStop;
  end: GeocodedStop;
  orderedStops: OrderedStop[];
  totalDistanceKm: number;
};
