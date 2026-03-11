import type {
  AddressSuggestion as SharedAddressSuggestion,
  GeocodedStop as SharedGeocodedStop,
  LatLng as SharedLatLng,
  OptimizeRouteResponse as SharedOptimizeRouteResponse,
  OrderedStop as SharedOrderedStop,
  RouteLeg as SharedRouteLeg,
} from "../../../shared/contracts";

export type Theme = "light" | "dark";

export type LatLng = SharedLatLng;
export type GeocodedStop = SharedGeocodedStop;
export type OrderedStop = SharedOrderedStop;
export type RouteLeg = SharedRouteLeg;
export type AddressSuggestion = SharedAddressSuggestion;
export type OptimizeRouteResponse = SharedOptimizeRouteResponse;
