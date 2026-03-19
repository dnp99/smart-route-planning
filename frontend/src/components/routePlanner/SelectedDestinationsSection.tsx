import { useEffect, useState } from "react";
import { responsiveStyles } from "../responsiveStyles";
import type { SelectedPatientDestination } from "./routePlannerTypes";

const panelEmptyTextClassName =
  "m-0 text-sm text-slate-500 dark:text-slate-400";

const MoreActionsIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

type SelectedDestinationsSectionProps = {
  isVisible: boolean;
  isMobileViewport: boolean;
  selectedDestinations: SelectedPatientDestination[];
  expandedDestinationVisitKeys: Record<string, boolean>;
  onToggleDestinationDetails: (visitKey: string) => void;
  onRemoveDestinationVisit: (visitKey: string) => void;
  onSetDestinationVisitIncluded: (visitKey: string, isIncluded: boolean) => void;
  onUpdateDestinationPlanningWindow: (
    visitKey: string,
    field: "windowStart" | "windowEnd",
    value: string,
  ) => void;
  onSetDestinationPersistPlanningWindow: (
    visitKey: string,
    persistPlanningWindow: boolean,
  ) => void;
  onContinueToReview: () => void;
  onCollapse: () => void;
};

export const SelectedDestinationsSection = ({
  isVisible,
  isMobileViewport,
  selectedDestinations,
  expandedDestinationVisitKeys,
  onToggleDestinationDetails,
  onRemoveDestinationVisit,
  onSetDestinationVisitIncluded,
  onUpdateDestinationPlanningWindow,
  onSetDestinationPersistPlanningWindow,
  onContinueToReview,
  onCollapse,
}: SelectedDestinationsSectionProps) => {
  const [openDestinationActionsVisitKey, setOpenDestinationActionsVisitKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!openDestinationActionsVisitKey) {
      return;
    }

    const stillExists = selectedDestinations.some(
      (destination) => destination.visitKey === openDestinationActionsVisitKey,
    );
    if (!stillExists) {
      setOpenDestinationActionsVisitKey(null);
    }
  }, [openDestinationActionsVisitKey, selectedDestinations]);

  if (!isVisible) {
    return null;
  }

  return (
    <section className={responsiveStyles.panel}>
      <div className={responsiveStyles.cardHeader}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={responsiveStyles.cardTitle}>
            Selected destination patients
          </h2>
          {selectedDestinations.length > 0 && (
            <button
              type="button"
              aria-label="Collapse selected patients"
              onClick={onCollapse}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
        <p className={responsiveStyles.cardDescription}>
          Review the patients included in the route before you optimize it.
        </p>
      </div>
      <div className={responsiveStyles.destinationList}>
        {selectedDestinations.length === 0 ? (
          <p className={panelEmptyTextClassName}>
            No destination patients selected yet.
          </p>
        ) : (
          <ol className="m-0 space-y-2">
            {selectedDestinations.map((destination, index) => {
              const isDestinationExpanded =
                expandedDestinationVisitKeys[destination.visitKey] ??
                false;
              const isActionsMenuOpen =
                openDestinationActionsVisitKey === destination.visitKey;

              return (
                <li
                  key={destination.visitKey}
                  className={`rounded-xl border border-transparent px-2 py-2 text-sm text-slate-900 dark:border-transparent dark:text-slate-200 ${
                    destination.isIncluded ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className={responsiveStyles.destinationItemBody}>
                      <span className="min-w-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {index + 1}.
                      </span>
                      <div className="min-w-0 flex-1 break-words text-sm">
                        <span className="block font-semibold text-slate-900 dark:text-slate-100">
                          {destination.patientName}
                        </span>
                        <span className="block text-slate-600 dark:text-slate-300">
                          {destination.address}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 md:mt-0 md:ml-3 md:shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDestinationActionsVisitKey((current) =>
                            current === destination.visitKey ? null : current,
                          );
                          onToggleDestinationDetails(destination.visitKey);
                        }}
                        className={responsiveStyles.destinationDetailsToggle}
                      >
                        {isDestinationExpanded ? "Hide details" : "Edit window"}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Open actions for ${destination.patientName}`}
                          onClick={() =>
                            setOpenDestinationActionsVisitKey((current) =>
                              current === destination.visitKey ? null : destination.visitKey,
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <MoreActionsIcon className="h-4 w-4" />
                        </button>
                        {isActionsMenuOpen && (
                          <div className="absolute right-0 z-10 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <button
                              type="button"
                              aria-label={`Remove ${destination.patientName}`}
                              onClick={() => {
                                setOpenDestinationActionsVisitKey(null);
                                onRemoveDestinationVisit(destination.visitKey);
                              }}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {isDestinationExpanded && (
                    <div className="mt-2 md:ml-11">
                      <label className="mt-2 inline-flex items-start gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={destination.isIncluded}
                          onChange={(event) =>
                            onSetDestinationVisitIncluded(
                              destination.visitKey,
                              event.target.checked,
                            )
                          }
                        />
                        Include this visit in route
                      </label>
                      <div className="mt-2">
                        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                          {destination.requiresPlanningWindow
                            ? "No preferred window. Optimizer will auto-schedule unless you set one:"
                            : "Adjust planning window (plan-only unless saved):"}
                        </p>
                        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            type="time"
                            aria-label={`${destination.patientName} start`}
                            value={destination.windowStart}
                            onChange={(event) =>
                              onUpdateDestinationPlanningWindow(
                                destination.visitKey,
                                "windowStart",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                          <input
                            type="time"
                            aria-label={`${destination.patientName} end`}
                            value={destination.windowEnd}
                            onChange={(event) =>
                              onUpdateDestinationPlanningWindow(
                                destination.visitKey,
                                "windowEnd",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                        <label className="mt-2 inline-flex items-start gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={destination.persistPlanningWindow}
                            onChange={(event) =>
                              onSetDestinationPersistPlanningWindow(
                                destination.visitKey,
                                event.target.checked,
                              )
                            }
                          />
                          Save this window to patient record
                        </label>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {isMobileViewport && (
        <button
          type="button"
          onClick={onContinueToReview}
          className={responsiveStyles.secondaryButton}
        >
          Continue to Review
        </button>
      )}
    </section>
  );
};
