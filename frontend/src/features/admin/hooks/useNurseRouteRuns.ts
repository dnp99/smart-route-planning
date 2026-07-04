import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNurseRouteRuns, type AdminRouteRun } from "../api/adminService";

type RouteRunsState = {
  runs: AdminRouteRun[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
};

// Accumulating route-run history for one nurse: first page (last 7 days) on
// mount, then appends older pages via loadMore() using the server cursor.
export const useNurseRouteRuns = (nurseId: string | undefined) => {
  const [state, setState] = useState<RouteRunsState>({
    runs: [],
    nextCursor: null,
    hasMore: false,
    isLoading: true,
    isLoadingMore: false,
    error: "",
  });
  // Mirror the latest state so loadMore reads the current cursor without stale
  // closures or reading inside a setState updater.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!nurseId) {
      return;
    }
    let active = true;
    setState({
      runs: [],
      nextCursor: null,
      hasMore: false,
      isLoading: true,
      isLoadingMore: false,
      error: "",
    });

    void fetchNurseRouteRuns(nurseId)
      .then((page) => {
        if (active) {
          setState({
            runs: page.runs,
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
            isLoading: false,
            isLoadingMore: false,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unable to load route runs.",
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [nurseId]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (!nurseId || !current.hasMore || !current.nextCursor || current.isLoadingMore) {
      return;
    }
    const cursor = current.nextCursor;
    setState((prev) => ({ ...prev, isLoadingMore: true, error: "" }));

    try {
      const page = await fetchNurseRouteRuns(nurseId, cursor);
      setState((prev) => ({
        ...prev,
        runs: [...prev.runs, ...page.runs],
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        isLoadingMore: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: error instanceof Error ? error.message : "Unable to load more route runs.",
      }));
    }
  }, [nurseId]);

  return { ...state, loadMore };
};
