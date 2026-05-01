import { useCallback, useEffect, useState } from "react";
import {
  requestOptimizedRoute,
  type OptimizeRouteDestinationInput,
} from "../api/routePlannerService";
import type { WeeklyWorkingHours } from "../../../../../shared/contracts";
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
  preserveOrder?: boolean;
  workingHours?: WeeklyWorkingHours | null;
  optimizationObjective?: "time" | "distance";
};

type RouteOptimizationRuntimeCache = {
  snapshot: string;
  result: OptimizeRouteResponse;
};

let runtimeCache: RouteOptimizationRuntimeCache | null = null;

const SESSION_KEY = "routeOptimizationResult";

const readSessionResult = (): OptimizeRouteResponse | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OptimizeRouteResponse) : null;
  } catch {
    return null;
  }
};

const writeSessionResult = (result: OptimizeRouteResponse) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
  } catch {
    // sessionStorage unavailable (e.g. private mode quota) — silently skip
  }
};

const clearSessionResult = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
};

const buildOptimizationSnapshot = ({
  planningDate,
  optimizationObjective,
  startAddress,
  endAddress,
  destinations,
}: {
  planningDate?: string;
  optimizationObjective?: "time" | "distance";
  startAddress: string;
  endAddress: string;
  destinations: OptimizeRouteDestinationInput[];
}) =>
  [
    planningDate ?? "",
    optimizationObjective ?? "distance",
    startAddress,
    endAddress,
    destinations
      .map(
        (destination) =>
          `${destination.patientId}:${destination.windowStart}:${destination.windowEnd}:${destination.address}`,
      )
      .sort()
      .join(","),
  ].join("||");

export const useRouteOptimization = () => {
  const sessionResult = readSessionResult();
  const [result, setResult] = useState<OptimizeRouteResponse | null>(sessionResult);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);
  const [showOptimizeFlash, setShowOptimizeFlash] = useState(false);
  const [hasAttemptedOptimize, setHasAttemptedOptimize] = useState(sessionResult !== null);

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

  const restoreCachedResult = useCallback((snapshot: string) => {
    if (!runtimeCache || runtimeCache.snapshot !== snapshot) {
      return false;
    }

    setError("");
    setResult(runtimeCache.result);
    return true;
  }, []);

  const loadSavedResult = useCallback((savedResult: OptimizeRouteResponse) => {
    setError("");
    setResult(savedResult);
    setHasAttemptedOptimize(true);
    runtimeCache = null;
    clearSessionResult();
  }, []);

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
    clearSessionResult();
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
      writeSessionResult(optimizedResult);
      runtimeCache = {
        snapshot: buildOptimizationSnapshot({
          planningDate,
          optimizationObjective,
          startAddress,
          endAddress,
          destinations,
        }),
        result: optimizedResult,
      };
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
    restoreCachedResult,
    loadSavedResult,
    optimizeRoute,
  };
};
