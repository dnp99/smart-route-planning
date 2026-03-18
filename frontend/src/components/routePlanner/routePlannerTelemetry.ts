export const ROUTE_MAP_UNAVAILABLE_EVENT = "careflow.route-map.unavailable";

export type RouteMapUnavailableDetail = {
  orderedStopCount: number;
  routeLegCount: number;
  hasStartCoords: boolean;
  hasStopCoords: boolean;
};

export const emitRouteMapUnavailable = (detail: RouteMapUnavailableDetail) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<RouteMapUnavailableDetail>(ROUTE_MAP_UNAVAILABLE_EVENT, {
      detail,
    }),
  );
};
