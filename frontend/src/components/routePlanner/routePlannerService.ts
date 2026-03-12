import { resolveApiBaseUrl } from "../apiBaseUrl";
import {
  extractApiErrorMessage,
  parseOptimizeRouteResponse,
  type OptimizeRouteRequest,
} from "../../../../shared/contracts";

export const requestOptimizedRoute = async ({
  startAddress,
  endAddress,
  addresses,
  destinations,
}: OptimizeRouteRequest) => {
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
      destinations,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      extractApiErrorMessage(payload) ??
        "Unable to optimize route.",
    );
  }

  const parsedResponse = parseOptimizeRouteResponse(payload);
  if (!parsedResponse) {
    throw new Error("Unexpected API response format.");
  }

  return parsedResponse;
};
