import { useEffect, useMemo } from "react";
import { responsiveStyles } from "../responsiveStyles";

export type RouteRunPickerItem = {
  id: string;
  createdAt: string;
  optimizationObjective: "time" | "distance" | null;
  scheduledVisitCount: number;
  unscheduledVisitCount: number;
  algorithmVersion: string;
};

type RouteRunPickerModalProps = {
  isOpen: boolean;
  planningDateLabel: string;
  runs: RouteRunPickerItem[];
  selectedRunId: string | null;
  onClose: () => void;
  onSelectRun: (runId: string) => void;
  onConfirmSelection: () => void;
  isLoading?: boolean;
  isConfirming?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

const toObjectiveLabel = (value: RouteRunPickerItem["optimizationObjective"]) => {
  if (value === "time") return "Time";
  if (value === "distance") return "Distance";
  return "Not set";
};

const toCreatedAtLabel = (createdAt: string) => {
  const parsed = new Date(createdAt);
  if (isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function RouteRunPickerModal({
  isOpen,
  planningDateLabel,
  runs,
  selectedRunId,
  onClose,
  onSelectRun,
  onConfirmSelection,
  isLoading = false,
  isConfirming = false,
  errorMessage = "",
  onRetry,
}: RouteRunPickerModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirming) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isConfirming, isOpen, onClose]);

  const sortedRuns = useMemo(
    () =>
      [...runs].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      }),
    [runs],
  );

  const selectedRun = sortedRuns.find((run) => run.id === selectedRunId) ?? null;

  if (!isOpen) return null;

  return (
    <div
      className={responsiveStyles.modalBackdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onClose();
        }
      }}
    >
      <div className={`${responsiveStyles.modalSurface} flex flex-col gap-4`}>
        <header className="grid gap-1">
          <h2 className={responsiveStyles.cardTitle}>Select a saved route</h2>
          <p className={responsiveStyles.cardDescription}>{planningDateLabel}</p>
        </header>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            <p className="m-0">{errorMessage}</p>
            {onRetry ? (
              <button
                type="button"
                className="mt-2 text-sm font-semibold underline"
                onClick={onRetry}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !errorMessage && sortedRuns.length === 0 ? (
          <div className={responsiveStyles.panelMuted}>No saved routes for this day.</div>
        ) : null}

        {!isLoading && !errorMessage && sortedRuns.length > 0 ? (
          <ul className="m-0 max-h-72 list-none space-y-2 overflow-y-auto p-0">
            {sortedRuns.map((run) => {
              const isSelected = run.id === selectedRunId;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun(run.id)}
                    className={`w-full rounded-xl border bg-white p-3 text-left transition dark:bg-slate-950 ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-100 dark:border-blue-400 dark:ring-blue-900/50"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
                    <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Run at {toCreatedAtLabel(run.createdAt)}
                    </p>
                    <p className="m-0 mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Objective: {toObjectiveLabel(run.optimizationObjective)} •{" "}
                      {run.scheduledVisitCount} scheduled • {run.unscheduledVisitCount} unscheduled
                    </p>
                    <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Algorithm {run.algorithmVersion || "unknown"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            type="button"
            className={responsiveStyles.secondaryButton}
            onClick={onClose}
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className={responsiveStyles.primaryButton}
            onClick={onConfirmSelection}
            disabled={!selectedRun || isConfirming || isLoading || Boolean(errorMessage)}
          >
            {isConfirming ? "Opening..." : "Open selected route"}
          </button>
        </div>
      </div>
    </div>
  );
}
