import { useEffect, useState } from "react";
import { requestOptimizedRoute } from "./routePlannerService";
import type { OptimizeRouteResponse } from "../types";

type OptimizeRouteInput = {
  startAddress: string;
  endAddress: string;
  destinationAddresses: string[];
  canOptimize: boolean;
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
    endAddress,
    destinationAddresses,
    canOptimize,
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
        endAddress,
        addresses: destinationAddresses,
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
