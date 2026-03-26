import { useEffect, useState } from "react";
import {
  requestOptimizedRoute,
  type OptimizeRouteDestinationInput,
} from "../routePlanner/routePlannerService";
import type { WeeklyWorkingHours } from "../../../../shared/contracts";
import type { OptimizeRouteResponse } from "../types";

const RESULT_SESSION_KEY = "careflow_route_optimization_result";

const readPersistedResult = (): OptimizeRouteResponse | null => {
  try {
    const stored = sessionStorage.getItem(RESULT_SESSION_KEY);
    return stored ? (JSON.parse(stored) as OptimizeRouteResponse) : null;
  } catch {
    return null;
  }
};

type OptimizeRouteInput = {
  startAddress: string;
  startGooglePlaceId?: string | null;
  endAddress: string;
  endGooglePlaceId?: string | null;
  destinations: OptimizeRouteDestinationInput[];
  canOptimize: boolean;
  planningDate?: string;
  timezone?: string;
  preserveOrder?: boolean;
  workingHours?: WeeklyWorkingHours | null;
  optimizationObjective?: "time" | "distance";
};

export const useRouteOptimization = () => {
  const [result, setResult] = useState<OptimizeRouteResponse | null>(readPersistedResult);

  useEffect(() => {
    try {
      if (result) {
        sessionStorage.setItem(RESULT_SESSION_KEY, JSON.stringify(result));
      } else {
        sessionStorage.removeItem(RESULT_SESSION_KEY);
      }
    } catch {
      // sessionStorage unavailable or quota exceeded — ignore
    }
  }, [result]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);
  const [showOptimizeFlash, setShowOptimizeFlash] = useState(false);
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

  useEffect(() => {
    if (!showOptimizeFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowOptimizeFlash(false);
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showOptimizeFlash]);

  const optimizeRoute = async ({
    startAddress,
    startGooglePlaceId,
    endAddress,
    endGooglePlaceId,
    destinations,
    canOptimize,
    planningDate,
    timezone,
    preserveOrder,
    workingHours,
    optimizationObjective,
  }: OptimizeRouteInput) => {
    setError("");
    setResult(null);
    setShowOptimizeFlash(false);
    setHasAttemptedOptimize(true);

    if (!canOptimize) {
      return;
    }

    setIsLoading(true);
    if (preserveOrder === true) {
      setIsRecalculating(true);
    }

    try {
      const optimizedResult = await requestOptimizedRoute({
        startAddress,
        ...(startGooglePlaceId !== undefined ? { startGooglePlaceId } : {}),
        endAddress,
        ...(endGooglePlaceId !== undefined ? { endGooglePlaceId } : {}),
        destinations,
        ...(planningDate !== undefined ? { planningDate } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(preserveOrder === true ? { preserveOrder: true } : {}),
        ...(workingHours !== undefined ? { workingHours } : {}),
        ...(optimizationObjective !== undefined ? { optimizationObjective } : {}),
      });

      setResult(optimizedResult);
      setShowOptimizeSuccess(true);
      setShowOptimizeFlash(true);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
    }
  };

  return {
    result,
    error,
    isLoading,
    isRecalculating,
    showOptimizeSuccess,
    showOptimizeFlash,
    hasAttemptedOptimize,
    optimizeRoute,
  };
};
