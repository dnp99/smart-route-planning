import { useMemo, useState } from "react";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { toDisplayTime } from "../domain/routePlannerHelpers";
import { DestinationRow } from "./DestinationRow";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";

type SelectedDestinationsSectionProps = {
  isMobileViewport: boolean;
  isLoading: boolean;
  autoSeedHint: string;
  selectedDestinations: SelectedPatientDestination[];
  onClearSelectedDestinations: () => void;
  expandedDestinationVisitKeys: Record<string, boolean>;
  onToggleDestinationDetails: (visitKey: string) => void;
  onRemoveDestinationVisit: (visitKey: string) => void;
  onSetDestinationVisitIncluded: (visitKey: string, isIncluded: boolean) => void;
  onUpdateDestinationPlanningWindow: (
    visitKey: string,
    field: "windowStart" | "windowEnd" | "planningDate",
    value: string,
  ) => void;
  onSetDestinationPersistPlanningWindow: (visitKey: string, persistPlanningWindow: boolean) => void;
  activeVisitInstanceActionId: string | null;
  onVisitInstanceStatusChange: (visitId: string, status: "scheduled" | "cancelled") => Promise<void>;
  onVisitInstanceReschedule: (
    visitId: string,
    updates: { planningDate?: string; windowStart?: string; windowEnd?: string },
  ) => Promise<void>;
};

export const SelectedDestinationsSection = ({
  isMobileViewport,
  isLoading,
  autoSeedHint,
  selectedDestinations,
  onClearSelectedDestinations,
  expandedDestinationVisitKeys,
  onToggleDestinationDetails,
  onRemoveDestinationVisit,
  onSetDestinationVisitIncluded,
  onUpdateDestinationPlanningWindow,
  onSetDestinationPersistPlanningWindow,
  activeVisitInstanceActionId,
  onVisitInstanceStatusChange,
  onVisitInstanceReschedule,
}: SelectedDestinationsSectionProps) => {
  const MOBILE_SELECTED_VISIBLE_ROWS = 15;
  const MOBILE_SELECTED_ROW_HEIGHT_PX = 88;
  const mobileSelectedListMaxHeight = `${
    MOBILE_SELECTED_VISIBLE_ROWS * MOBILE_SELECTED_ROW_HEIGHT_PX
  }px`;
  const [collapsedPatientGroups, setCollapsedPatientGroups] = useState<Record<string, boolean>>({});

  const selectedByPatient = useMemo(() => {
    const groups: Array<{
      patientId: string;
      patientName: string;
      destinations: SelectedPatientDestination[];
    }> = [];
    const groupByPatientId = new Map<string, (typeof groups)[number]>();

    selectedDestinations.forEach((destination) => {
      const existingGroup = groupByPatientId.get(destination.patientId);
      if (existingGroup) {
        existingGroup.destinations.push(destination);
        return;
      }

      const nextGroup = {
        patientId: destination.patientId,
        patientName: destination.patientName,
        destinations: [destination],
      };
      groups.push(nextGroup);
      groupByPatientId.set(destination.patientId, nextGroup);
    });

    return groups;
  }, [selectedDestinations]);

  const formatWindowLabel = (destination: SelectedPatientDestination, index: number) => {
    const hasWindow = destination.windowStart || destination.windowEnd;
    if (!hasWindow) {
      return `Window ${index + 1}`;
    }
    return `Window ${index + 1}: ${destination.windowStart ? toDisplayTime(destination.windowStart) : "—"} - ${destination.windowEnd ? toDisplayTime(destination.windowEnd) : "—"}`;
  };
  const formatSingleRowSubtitle = (destination: SelectedPatientDestination) => {
    if (!destination.windowStart && !destination.windowEnd) {
      return undefined;
    }
    return `${destination.windowStart ? toDisplayTime(destination.windowStart) : "—"} - ${destination.windowEnd ? toDisplayTime(destination.windowEnd) : "—"}`;
  };
  const isPatientGroupCollapsed = (patientId: string, defaultCollapsed: boolean) =>
    collapsedPatientGroups[patientId] ?? defaultCollapsed;
  const togglePatientGroupCollapsed = (patientId: string, defaultCollapsed: boolean) => {
    setCollapsedPatientGroups((current) => ({
      ...current,
      [patientId]: !isPatientGroupCollapsed(patientId, defaultCollapsed),
    }));
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className={`${responsiveStyles.patientColumnLabel} shrink-0`}>
            Selected ({selectedByPatient.length})
          </p>
          {autoSeedHint.length > 0 && (
            <p className="m-0 min-w-0 truncate text-xs text-blue-700 dark:text-blue-300 ml-auto">
              {autoSeedHint}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClearSelectedDestinations}
          disabled={selectedDestinations.length === 0 || isLoading}
          aria-label="Clear selected clients"
          title="Clear selected clients"
          className={responsiveStyles.selectedListClearButton}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
          <span>Clear list</span>
        </button>
      </div>
      <div
        className={responsiveStyles.destinationList}
        style={isMobileViewport ? { maxHeight: mobileSelectedListMaxHeight } : undefined}
      >
        {isLoading ? (
          <ul className="m-0 space-y-2 pr-2" aria-label="Loading clients">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className={`${responsiveStyles.routeSkeletonPulse} h-3.5 w-32`} />
                  <div className={`${responsiveStyles.routeSkeletonPulse} h-3 w-48`} />
                </div>
              </li>
            ))}
          </ul>
        ) : selectedDestinations.length === 0 ? (
          <p className={responsiveStyles.panelEmptyText}>No clients selected yet.</p>
        ) : (
          <ol className="m-0 space-y-2 pr-2">
            {selectedByPatient.map((group, groupIndex) => {
              const collapsedByDefault = group.destinations.length > 1;
              const isCollapsed = isPatientGroupCollapsed(group.patientId, collapsedByDefault);

              if (group.destinations.length === 1) {
                return (
                  <DestinationRow
                    key={group.destinations[0].visitKey}
                    destination={group.destinations[0]}
                    index={groupIndex}
                    compact
                    displayName={group.patientName}
                    displaySubtitle={formatSingleRowSubtitle(group.destinations[0])}
                    inputLabelPrefix={group.patientName}
                    isExpanded={
                      expandedDestinationVisitKeys[group.destinations[0].visitKey] ?? false
                    }
                    onToggleDetails={() =>
                      onToggleDestinationDetails(group.destinations[0].visitKey)
                    }
                    onRemove={() => onRemoveDestinationVisit(group.destinations[0].visitKey)}
                    onSetIncluded={(v) =>
                      onSetDestinationVisitIncluded(group.destinations[0].visitKey, v)
                    }
                     onUpdateWindow={(field, value) =>
                       onUpdateDestinationPlanningWindow(
                         group.destinations[0].visitKey,
                        field,
                        value,
                      )
                    }
                     onSetPersistWindow={(v) =>
                       onSetDestinationPersistPlanningWindow(group.destinations[0].visitKey, v)
                     }
                     activeVisitInstanceActionId={activeVisitInstanceActionId}
                     onVisitInstanceStatusChange={onVisitInstanceStatusChange}
                     onVisitInstanceReschedule={onVisitInstanceReschedule}
                   />
                );
              }

              return (
                <li key={group.patientId} className="px-2 py-1">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={`Toggle windows for ${group.patientName}`}
                    onClick={() => togglePatientGroupCollapsed(group.patientId, collapsedByDefault)}
                    className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className={responsiveStyles.destinationIndex}>{groupIndex + 1}.</span>
                    <p className="m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {group.patientName}
                    </p>
                    <span className={responsiveStyles.countPill}>{group.destinations.length}</span>
                    <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                      {group.destinations.length} windows
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="text-slate-500 dark:text-slate-400"
                    >
                      {isCollapsed ? (
                        <polyline points="6 9 12 15 18 9" />
                      ) : (
                        <polyline points="18 15 12 9 6 15" />
                      )}
                    </svg>
                  </button>
                  {!isCollapsed && (
                    <ol className="m-0 space-y-2 pr-2 pl-3">
                      {group.destinations.map((destination, windowIndex) => (
                        <DestinationRow
                          key={destination.visitKey}
                          destination={destination}
                          index={windowIndex}
                          showIndex={false}
                          compact
                          displayName={formatWindowLabel(destination, windowIndex)}
                          inputLabelPrefix={`${group.patientName} window ${windowIndex + 1}`}
                          removeAriaLabel={`Remove ${group.patientName} window ${windowIndex + 1}`}
                          isExpanded={expandedDestinationVisitKeys[destination.visitKey] ?? false}
                          onToggleDetails={() => onToggleDestinationDetails(destination.visitKey)}
                          onRemove={() => onRemoveDestinationVisit(destination.visitKey)}
                          onSetIncluded={(v) =>
                            onSetDestinationVisitIncluded(destination.visitKey, v)
                          }
                           onUpdateWindow={(field, value) =>
                             onUpdateDestinationPlanningWindow(destination.visitKey, field, value)
                           }
                           onSetPersistWindow={(v) =>
                             onSetDestinationPersistPlanningWindow(destination.visitKey, v)
                           }
                           activeVisitInstanceActionId={activeVisitInstanceActionId}
                           onVisitInstanceStatusChange={onVisitInstanceStatusChange}
                           onVisitInstanceReschedule={onVisitInstanceReschedule}
                         />
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
