import {
  parseOptimizeRouteResponse,
  type OptimizeRouteRequest,
} from "../../../../shared/contracts";
import { requestAuthedJson } from "../auth/authFetch";

export const requestOptimizedRoute = async ({
  startAddress,
  startGooglePlaceId,
  endAddress,
  endGooglePlaceId,
  destinations,
}: OptimizeRouteRequest) => {
  const payload = await requestAuthedJson(
    "/api/optimize-route",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startAddress,
        startGooglePlaceId,
        endAddress,
        endGooglePlaceId,
        destinations,
      }),
    },
    "Unable to optimize route.",
  );

  const parsedResponse = parseOptimizeRouteResponse(payload);
  if (!parsedResponse) {
    throw new Error("Unexpected API response format.");
  }

  return parsedResponse;
};
