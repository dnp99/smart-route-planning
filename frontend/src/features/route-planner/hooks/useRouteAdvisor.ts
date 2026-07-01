import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteAdvisorResponse } from "../../../../../shared/contracts";
import type { OptimizeRouteResponse } from "../types";
import { buildRouteAdvisorContext } from "../domain/buildRouteAdvisorContext";
import { requestRouteAdvice, RouteAdvisorUnavailableError } from "../api/routePlannerService";

type RouteAdvisorState = {
  advice: RouteAdvisorResponse | null;
  isLoading: boolean;
  error: string;
  // 503 from the backend (no API key) — the panel hides itself entirely.
  unavailable: boolean;
};

const IDLE_STATE: RouteAdvisorState = {
  advice: null,
  isLoading: false,
  error: "",
  unavailable: false,
};

// Cheap identity for "is this the same route?" — order + timing + lateness +
// unscheduled count. Used only to reset the displayed advice when the route
// changes; the network cache below is keyed on the full de-identified context.
const buildRouteSignature = (result: OptimizeRouteResponse): string =>
  [
    result.start.departureTime,
    result.orderedStops.map((stop) => `${stop.stopId}@${stop.arrivalTime}`).join(","),
    result.metrics.totalLateSeconds,
    result.unscheduledTasks.length,
  ].join("|");

export const useRouteAdvisor = (result: OptimizeRouteResponse | null) => {
  const [state, setState] = useState<RouteAdvisorState>(IDLE_STATE);
  const cacheRef = useRef(new Map<string, RouteAdvisorResponse>());
  // The context key of the request whose result should be shown — guards against
  // a stale in-flight response landing after the route changed.
  const activeKeyRef = useRef<string | null>(null);

  const signature = result ? buildRouteSignature(result) : null;

  // A new/edited route returns the panel to its idle state; the network cache
  // persists, so re-requesting a previously-seen route is still instant.
  useEffect(() => {
    activeKeyRef.current = null;
    setState(IDLE_STATE);
  }, [signature]);

  const requestAdvice = useCallback(async (target: OptimizeRouteResponse, planningDate: string) => {
    const context = buildRouteAdvisorContext(target, planningDate);
    const key = JSON.stringify(context);
    activeKeyRef.current = key;

    const cached = cacheRef.current.get(key);
    if (cached) {
      setState({ advice: cached, isLoading: false, error: "", unavailable: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: "", unavailable: false }));

    try {
      const advice = await requestRouteAdvice(context);
      cacheRef.current.set(key, advice);
      if (activeKeyRef.current !== key) {
        return; // a newer request or a route change superseded this one
      }
      setState({ advice, isLoading: false, error: "", unavailable: false });
    } catch (error) {
      if (activeKeyRef.current !== key) {
        return;
      }
      if (error instanceof RouteAdvisorUnavailableError) {
        setState({ advice: null, isLoading: false, error: "", unavailable: true });
        return;
      }
      setState({
        advice: null,
        isLoading: false,
        unavailable: false,
        error: error instanceof Error ? error.message : "Unable to get route advice.",
      });
    }
  }, []);

  return {
    advice: state.advice,
    isLoadingAdvice: state.isLoading,
    adviceError: state.error,
    adviceUnavailable: state.unavailable,
    requestAdvice,
  };
};
