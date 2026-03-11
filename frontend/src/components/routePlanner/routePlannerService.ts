import { resolveApiBaseUrl } from "../apiBaseUrl";
import type { OptimizeRouteResponse } from "../types";

type OptimizeRouteErrorResponse = {
  error?: string;
};

const isOptimizeRouteResponse = (
  payload: unknown,
): payload is OptimizeRouteResponse => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const maybePayload = payload as Partial<OptimizeRouteResponse>;
  return (
    typeof maybePayload.totalDistanceKm === "number" &&
    typeof maybePayload.totalDistanceMeters === "number" &&
    typeof maybePayload.totalDurationSeconds === "number" &&
    typeof maybePayload.start?.address === "string" &&
    typeof maybePayload.end?.address === "string" &&
    Array.isArray(maybePayload.orderedStops) &&
    Array.isArray(maybePayload.routeLegs)
  );
};

const extractOptimizeRouteErrorMessage = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const maybePayload = payload as OptimizeRouteErrorResponse;
  return typeof maybePayload.error === "string" ? maybePayload.error : null;
};

type OptimizeRouteParams = {
  startAddress: string;
  endAddress: string;
  addresses: string[];
};

export const requestOptimizedRoute = async ({
  startAddress,
  endAddress,
  addresses,
}: OptimizeRouteParams) => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/optimize-route`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startAddress,
      endAddress,
      addresses,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      extractOptimizeRouteErrorMessage(payload) ??
        "Unable to optimize route.",
    );
  }

  if (!isOptimizeRouteResponse(payload)) {
    throw new Error("Unexpected API response format.");
  }

  return payload;
};
