import { useMemo, useState } from "react";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { toDisplayTime } from "../domain/routePlannerHelpers";
import { DestinationRow } from "./DestinationRow";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";

type SelectedDestinationsSectionProps = {
  isMobileViewport: boolean;
  isLoading: boolean;
  autoSeedHint: string;
  startAddress: string;
  endAddress: string;
  planningDate: string;
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
  onVisitInstanceStatusChange: (
    visitId: string,
    status: "scheduled" | "cancelled",
  ) => Promise<void>;
  onVisitInstanceReschedule: (
    visitId: string,
    updates: { planningDate?: string; windowStart?: string; windowEnd?: string },
  ) => Promise<void>;
};

const getInitialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatPlanningWeekday = (planningDate: string) => {
  if (!planningDate) return "";
  const parsed = new Date(`${planningDate}T12:00:00`);
  const time = parsed.getTime();
  if (time !== time) return ""; // NaN guard (Number.isNaN unavailable per es-compat)
  return parsed.toLocaleDateString("en-US", { weekday: "long" });
};

const splitAddressLine = (address: string) => {
  const idx = address.indexOf(", ");
  if (idx === -1) return { primary: address, secondary: "" };
  return { primary: address.slice(0, idx), secondary: address.slice(idx + 2) };
};

// Render a window as a time range that shares the trailing meridiem when both
// ends have the same one ("8:40–8:55 AM"), per the Figma. `tight` controls the
// dash spacing — tight for the green pills, spaced for inline subtitles.
const formatWindowRange = (startRaw: string, endRaw: string, tight: boolean) => {
  const start = startRaw ? toDisplayTime(startRaw) : "—";
  const end = endRaw ? toDisplayTime(endRaw) : "—";
  const dash = tight ? "–" : " – ";
  if (startRaw && endRaw && start.slice(-2) === end.slice(-2)) {
    return `${start.slice(0, -3)}${dash}${end}`;
  }
  return `${start}${dash}${end}`;
};

export const SelectedDestinationsSection = ({
  isMobileViewport,
  isLoading,
  startAddress,
  endAddress,
  planningDate,
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
  const selectedVisitCount = selectedDestinations.length;
  const planningWeekday = formatPlanningWeekday(planningDate);

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

  const formatWindowLabel = (destination: SelectedPatientDestination, _index: number) => {
    if (!destination.windowStart && !destination.windowEnd) {
      return "No preferred window";
    }
    return formatWindowRange(destination.windowStart, destination.windowEnd, false);
  };
  const formatSingleRowSubtitle = (destination: SelectedPatientDestination) => {
    if (!destination.windowStart && !destination.windowEnd) {
      return undefined;
    }
    return formatWindowRange(destination.windowStart, destination.windowEnd, false);
  };
  const formatWindowSubtitle = (index: number) => `Window ${index + 1}`;
  const formatWindowChip = (destination: SelectedPatientDestination) => {
    if (!destination.windowStart && !destination.windowEnd) {
      return "No window";
    }
    return formatWindowRange(destination.windowStart, destination.windowEnd, true);
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
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={responsiveStyles.patientColumnLabel}>Your Route</p>
          <span className="mt-0.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {selectedByPatient.length} client{selectedByPatient.length === 1 ? "" : "s"} ·{" "}
            {selectedVisitCount} visit{selectedVisitCount === 1 ? "" : "s"}
            {planningWeekday ? ` · scheduled for ${planningWeekday}` : ""}
          </span>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={onClearSelectedDestinations}
            disabled={selectedDestinations.length === 0 || isLoading}
            aria-label="Clear selected clients"
            title="Clear selected clients"
            className={`${responsiveStyles.selectedListClearButton} ml-auto`}
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
            <span>Clear</span>
          </button>
        </div>
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
          <div className={responsiveStyles.selectedTimelineRail}>
            {startAddress.length > 0 &&
              (() => {
                const start = splitAddressLine(startAddress);
                return (
                  <div className="relative">
                    <span className={responsiveStyles.selectedTimelineStartNode}>
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
                      >
                        <circle cx="12" cy="12" r="7" />
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <p className="m-0 flex items-baseline gap-1.5">
                      <span className={`${responsiveStyles.routeTimelineStartLabel} shrink-0`}>
                        Start
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-slate-300 dark:text-slate-600"
                      >
                        ·
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {start.primary}
                      </span>
                    </p>
                  </div>
                );
              })()}

            <ol className="m-0 list-none space-y-3 p-0">
              {selectedByPatient.map((group, groupIndex) => {
                const collapsedByDefault = group.destinations.length > 1;
                const isCollapsed = isPatientGroupCollapsed(group.patientId, collapsedByDefault);
                const initials = getInitialsFromName(group.patientName);

                return (
                  <li key={group.patientId} className="relative">
                    <span className={responsiveStyles.selectedTimelineNode}>{groupIndex + 1}</span>
                    {group.destinations.length === 1 ? (
                      <DestinationRow
                        destination={group.destinations[0]}
                        index={groupIndex}
                        showIndex={false}
                        isMobileViewport={isMobileViewport}
                        avatarInitials={initials}
                        roundedLarge
                        inlineScheduledPill
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
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                        {(() => {
                          const headerInner = (
                            <>
                              <span className={responsiveStyles.clientAvatar} aria-hidden="true">
                                {initials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {group.patientName}
                                  </p>
                                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {group.destinations.length} windows
                                    {!isMobileViewport && (
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        {isCollapsed ? (
                                          <polyline points="6 9 12 15 18 9" />
                                        ) : (
                                          <polyline points="18 15 12 9 6 15" />
                                        )}
                                      </svg>
                                    )}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {group.destinations.map((destination) => (
                                    <span
                                      key={destination.visitKey}
                                      className={responsiveStyles.routeWindowPill}
                                    >
                                      {formatWindowChip(destination)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                          // On mobile the pills already show every window, so the card is
                          // static — no toggle/expand. Desktop keeps the expand-to-edit.
                          return isMobileViewport ? (
                            <div className="flex w-full items-center gap-3 px-3 py-2.5">
                              {headerInner}
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-expanded={!isCollapsed}
                              aria-label={`Toggle windows for ${group.patientName}`}
                              onClick={() =>
                                togglePatientGroupCollapsed(group.patientId, collapsedByDefault)
                              }
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              {headerInner}
                            </button>
                          );
                        })()}
                        {!isMobileViewport && !isCollapsed && (
                          <div className="space-y-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
                            {group.destinations.map((destination, windowIndex) => (
                              <DestinationRow
                                key={destination.visitKey}
                                destination={destination}
                                index={windowIndex}
                                showIndex={false}
                                isMobileViewport={isMobileViewport}
                                compact
                                displayName={formatWindowLabel(destination, windowIndex)}
                                displaySubtitle={formatWindowSubtitle(windowIndex)}
                                inputLabelPrefix={`${group.patientName} window ${windowIndex + 1}`}
                                removeAriaLabel={`Remove ${group.patientName} window ${windowIndex + 1}`}
                                isExpanded={
                                  expandedDestinationVisitKeys[destination.visitKey] ?? false
                                }
                                onToggleDetails={() =>
                                  onToggleDestinationDetails(destination.visitKey)
                                }
                                onRemove={() => onRemoveDestinationVisit(destination.visitKey)}
                                onSetIncluded={(v) =>
                                  onSetDestinationVisitIncluded(destination.visitKey, v)
                                }
                                onUpdateWindow={(field, value) =>
                                  onUpdateDestinationPlanningWindow(
                                    destination.visitKey,
                                    field,
                                    value,
                                  )
                                }
                                onSetPersistWindow={(v) =>
                                  onSetDestinationPersistPlanningWindow(destination.visitKey, v)
                                }
                                activeVisitInstanceActionId={activeVisitInstanceActionId}
                                onVisitInstanceStatusChange={onVisitInstanceStatusChange}
                                onVisitInstanceReschedule={onVisitInstanceReschedule}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {(() => {
              // Always render the END cap so the rail never dangles past the last
              // node. When no ending point is set yet, prompt for one.
              const end = endAddress.length > 0 ? splitAddressLine(endAddress) : null;
              return (
                <div className="relative">
                  <span className={responsiveStyles.selectedTimelineEndNode}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </span>
                  <p className="m-0 flex items-baseline gap-1.5">
                    <span className={`${responsiveStyles.tripEndLabel} shrink-0`}>End</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-slate-300 dark:text-slate-600"
                    >
                      ·
                    </span>
                    {end ? (
                      <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {end.primary}
                      </span>
                    ) : (
                      <span className="min-w-0 truncate text-sm italic text-slate-400 dark:text-slate-500">
                        Set an ending point
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
