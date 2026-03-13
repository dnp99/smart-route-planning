import type {
  AddressSuggestion as SharedAddressSuggestion,
  OptimizeRouteV2LatLng as SharedLatLng,
  OptimizeRouteV2OrderedStop as SharedOrderedStop,
  OptimizeRouteV2Response as SharedOptimizeRouteResponse,
  OptimizeRouteV2RouteLeg as SharedRouteLeg,
  OptimizeRouteV2UnscheduledTask as SharedUnscheduledTask,
  OptimizeRouteV2WindowType as SharedWindowType,
} from "../../../shared/contracts";

export type Theme = "light" | "dark";

export type LatLng = SharedLatLng;
export type GeocodedStop = SharedOptimizeRouteResponse["start"];
export type OrderedStop = SharedOrderedStop;
export type RouteLeg = SharedRouteLeg;
export type AddressSuggestion = SharedAddressSuggestion;
export type WindowType = SharedWindowType;

export type UnscheduledTask = SharedUnscheduledTask & {
  patientName?: string;
  address?: string;
  windowStart?: string;
  windowEnd?: string;
  windowType?: SharedWindowType;
};

export type OptimizeRouteResponse = Omit<
  SharedOptimizeRouteResponse,
  "unscheduledTasks"
> & {
  unscheduledTasks: UnscheduledTask[];
};
