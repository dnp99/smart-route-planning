import { useEffect, useState } from "react";
import {
  requestOptimizedRoute,
  type OptimizeRouteDestinationInput,
} from "./routePlannerService";
import type { OptimizeRouteResponse } from "../types";

type OptimizeRouteInput = {
  startAddress: string;
  startGooglePlaceId?: string | null;
  endAddress: string;
  endGooglePlaceId?: string | null;
  destinations: OptimizeRouteDestinationInput[];
  canOptimize: boolean;
  planningDate?: string;
  timezone?: string;
};

export const useRouteOptimization = () => {
  const [result, setResult] = useState<OptimizeRouteResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);
  const [hasAttemptedOptimize, setHasAttemptedOptimize] = useState(false);

  useEffect(() => {
    if (!showOptimizeSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowOptimizeSuccess(false);
    }, 750);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showOptimizeSuccess]);

  const optimizeRoute = async ({
    startAddress,
    startGooglePlaceId,
    endAddress,
    endGooglePlaceId,
    destinations,
    canOptimize,
    planningDate,
    timezone,
  }: OptimizeRouteInput) => {
    setError("");
    setResult(null);
    setHasAttemptedOptimize(true);

    if (!canOptimize) {
      return;
    }

    setIsLoading(true);

    try {
      const optimizedResult = await requestOptimizedRoute({
        startAddress,
        ...(startGooglePlaceId !== undefined ? { startGooglePlaceId } : {}),
        endAddress,
        ...(endGooglePlaceId !== undefined ? { endGooglePlaceId } : {}),
        destinations,
        ...(planningDate !== undefined ? { planningDate } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      });

      setResult(optimizedResult);
      setShowOptimizeSuccess(true);
    } catch (apiError) {
      setError(
        apiError instanceof Error
          ? apiError.message
          : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    result,
    error,
    isLoading,
    showOptimizeSuccess,
    hasAttemptedOptimize,
    optimizeRoute,
  };
};
