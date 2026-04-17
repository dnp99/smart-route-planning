import { useEffect, useState } from "react";
import type { OptimizeRouteResponse } from "../types";

type UseRoutePlannerWarningsStateParams = {
  result: OptimizeRouteResponse | null;
};

export function useRoutePlannerWarningsState({ result }: UseRoutePlannerWarningsStateParams) {
  const [expandedResultTaskIds, setExpandedResultTaskIds] = useState<Record<string, boolean>>({});
  const [expandedResultEndingStopIds, setExpandedResultEndingStopIds] = useState<
    Record<string, boolean>
  >({});
  const [conflictWarningsDismissed, setConflictWarningsDismissed] = useState(false);
  const [latenessWarningsDismissed, setLatenessWarningsDismissed] = useState(false);

  useEffect(() => {
    setExpandedResultTaskIds({});
    setExpandedResultEndingStopIds({});
    setConflictWarningsDismissed(false);
    setLatenessWarningsDismissed(false);
  }, [result]);

  const toggleResultTask = (taskId: string) => {
    setExpandedResultTaskIds((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
  };

  const toggleResultEndingStop = (stopId: string) => {
    setExpandedResultEndingStopIds((current) => ({
      ...current,
      [stopId]: !current[stopId],
    }));
  };

  return {
    expandedResultTaskIds,
    expandedResultEndingStopIds,
    conflictWarningsDismissed,
    latenessWarningsDismissed,
    dismissConflictWarnings: () => setConflictWarningsDismissed(true),
    dismissLatenessWarnings: () => setLatenessWarningsDismissed(true),
    toggleResultTask,
    toggleResultEndingStop,
  };
}
