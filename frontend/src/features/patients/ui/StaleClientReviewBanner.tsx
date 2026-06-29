import type { Patient } from "../../../../../shared/contracts";

type StaleClientReviewBannerProps = {
  staleClients: Patient[];
  isExpanded: boolean;
  onSetExpanded: (value: boolean) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onArchiveSelected: () => void;
  onDismiss: () => void;
  isBusy: boolean;
  error: string;
};

export const StaleClientReviewBanner = ({
  staleClients,
  isExpanded,
  onSetExpanded,
  selectedIds,
  onToggleSelect,
  onArchiveSelected,
  onDismiss,
  isBusy,
  error,
}: StaleClientReviewBannerProps) => {
  const count = staleClients.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold">
            {count} client{count === 1 ? "" : "s"} haven&apos;t been used in 30+ days
          </p>
          <p className="m-0 mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            Review and archive the ones you no longer need — nothing is deleted automatically.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onSetExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExpanded ? "Hide" : "Review"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isBusy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            Keep all
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 border-t border-amber-200 pt-3 dark:border-amber-900/50">
          <ul className="m-0 flex max-h-60 list-none flex-col gap-1 overflow-y-auto p-0">
            {staleClients.map((patient) => (
              <li key={patient.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-amber-100/60 dark:hover:bg-amber-900/30">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(patient.id)}
                    onChange={() => onToggleSelect(patient.id)}
                    className="h-4 w-4 shrink-0 accent-amber-600"
                  />
                  <span className="shrink-0 text-sm font-medium">
                    {patient.firstName} {patient.lastName}
                  </span>
                  <span className="min-w-0 truncate text-xs text-amber-800 dark:text-amber-300">
                    {patient.address}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onArchiveSelected}
              disabled={isBusy || selectedCount === 0}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? "Archiving..." : `Archive selected (${selectedCount})`}
            </button>
            <span className="text-xs text-amber-800 dark:text-amber-300">
              Archived clients can be re-added later; they reactivate automatically when scheduled.
            </span>
          </div>

          {error && (
            <p className="m-0 mt-2 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
};
