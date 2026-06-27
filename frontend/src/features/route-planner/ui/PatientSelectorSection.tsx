import { responsiveStyles } from "../../../components/responsiveStyles";
import { SelectedDestinationsSection } from "./SelectedDestinationsSection";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";
import type { Patient } from "../../../../../shared/contracts/patients";
import { formatPatientNameFromParts, getPatientInitials } from "../../patients/domain/patientName";

const MOBILE_SEARCH_VISIBLE_ROWS = 15;
const MOBILE_SEARCH_ROW_HEIGHT_PX = 88;

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = () => (
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
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const RouteIcon = () => (
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
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </svg>
);

const ClockIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SyncIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M21 21v-5h-5" />
  </svg>
);

type PatientSelectorSectionProps = {
  isVisible: boolean;
  isMobileViewport: boolean;
  isExpanded: boolean;
  onSetExpanded: (v: boolean) => void;
  destinationCount: number;
  autoSeedHint: string;
  destinationSearchResults: Patient[];
  destinationSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isSearchLoading: boolean;
  isVisitInstancesLoading: boolean;
  searchError: string;
  createPatientError: string;
  startAddress: string;
  resolvedEndAddress: string;
  planningDate: string;
  selectedDestinations: SelectedPatientDestination[];
  expandedDestinationVisitKeys: Record<string, boolean>;
  onAddPatient: (patient: Patient) => void;
  onOpenCreatePatient: () => void;
  onToggleDestinationDetails: (visitKey: string) => void;
  onClearSelectedDestinations: () => void;
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
  // Optimize CTA (desktop only — mobile lives in RouteResultSection footer)
  hasResult: boolean;
  isLoading: boolean;
  canOptimize: boolean;
  hasChangedSinceLastOptimize: boolean;
  showOptimizeSuccess: boolean;
  optimizationObjective: "time" | "distance";
  defaultOptimizationObjective: "time" | "distance";
  onOptimizationObjectiveChange: (value: "time" | "distance") => void;
};

export const PatientSelectorSection = ({
  isVisible,
  isMobileViewport,
  isExpanded,
  onSetExpanded,
  destinationCount,
  autoSeedHint,
  destinationSearchResults,
  destinationSearchQuery,
  onSearchQueryChange,
  isSearchLoading,
  isVisitInstancesLoading,
  searchError,
  createPatientError,
  startAddress,
  resolvedEndAddress,
  planningDate,
  selectedDestinations,
  expandedDestinationVisitKeys,
  onAddPatient,
  onOpenCreatePatient,
  onToggleDestinationDetails,
  onClearSelectedDestinations,
  onRemoveDestinationVisit,
  onSetDestinationVisitIncluded,
  onUpdateDestinationPlanningWindow,
  onSetDestinationPersistPlanningWindow,
  activeVisitInstanceActionId,
  onVisitInstanceStatusChange,
  onVisitInstanceReschedule,
  hasResult,
  isLoading,
  canOptimize,
  hasChangedSinceLastOptimize,
  showOptimizeSuccess,
  optimizationObjective,
  defaultOptimizationObjective,
  onOptimizationObjectiveChange,
}: PatientSelectorSectionProps) => {
  if (!isVisible) return null;

  const isContentVisible = isExpanded || isMobileViewport;
  const isCollapsedDesktop = !isExpanded && !isMobileViewport;
  const mobileSearchListMaxHeight = `${MOBILE_SEARCH_VISIBLE_ROWS * MOBILE_SEARCH_ROW_HEIGHT_PX}px`;

  // Preview row: first 3 unique patient names abbreviated (e.g. "Ravi R")
  const uniquePreviewDestinations = selectedDestinations.filter((destination, index, all) => {
    return all.findIndex((candidate) => candidate.patientId === destination.patientId) === index;
  });
  const MAX_PREVIEW = 3;
  const previewNames = uniquePreviewDestinations.slice(0, MAX_PREVIEW).map((d) => {
    const parts = d.patientName.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}` : parts[0];
  });
  const extraCount = uniquePreviewDestinations.length - previewNames.length;
  const previewNamesText = previewNames.join(" · ");

  const isOptimizeDisabled =
    destinationCount === 0 ||
    isLoading ||
    !canOptimize ||
    (hasResult && !hasChangedSinceLastOptimize);
  const defaultObjectiveLabel =
    defaultOptimizationObjective === "distance" ? "Less driving" : "Finish sooner";
  const routePreferenceControl = (
    <div className="flex items-center gap-2">
      <span className="hidden whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400 lg:inline">
        Optimize for
      </span>
      <div
        className={responsiveStyles.segmentedControlContainer}
        aria-label={`Route preference (default: ${defaultObjectiveLabel})`}
        title={`Route preference (default: ${defaultObjectiveLabel})`}
      >
        <button
          type="button"
          onClick={() => onOptimizationObjectiveChange("distance")}
          aria-pressed={optimizationObjective === "distance"}
          className={`${responsiveStyles.segmentedControlButtonBase} ${
            optimizationObjective === "distance"
              ? responsiveStyles.segmentedControlButtonActive
              : responsiveStyles.segmentedControlButtonInactive
          }`}
        >
          <span className="flex items-center gap-1.5">
            <RouteIcon />
            Less driving
          </span>
        </button>
        <button
          type="button"
          onClick={() => onOptimizationObjectiveChange("time")}
          aria-pressed={optimizationObjective === "time"}
          className={`${responsiveStyles.segmentedControlButtonBase} ${
            optimizationObjective === "time"
              ? responsiveStyles.segmentedControlButtonActive
              : responsiveStyles.segmentedControlButtonInactive
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ClockIcon />
            Finish sooner
          </span>
        </button>
      </div>
    </div>
  );

  const inRoutePatientIds = new Set(
    selectedDestinations.map((destination) => destination.patientId),
  );

  return (
    <section className={responsiveStyles.panel}>
      <div
        className={`flex items-center justify-between gap-2 ${
          isContentVisible ? "border-b border-slate-200 pb-3 dark:border-slate-800" : ""
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2
              className={
                isCollapsedDesktop ? responsiveStyles.formGroupEyebrow : responsiveStyles.cardTitle
              }
            >
              Clients
            </h2>
            {inRoutePatientIds.size > 0 && (
              <span className={responsiveStyles.countPill}>{inRoutePatientIds.size}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <div className="flex items-center gap-3">
            {isContentVisible && routePreferenceControl}
            {isCollapsedDesktop && routePreferenceControl}
            {!isMobileViewport && (
              <button
                type="submit"
                disabled={isOptimizeDisabled}
                className={responsiveStyles.optimizeButtonLarge}
                data-loading={isLoading ? "true" : "false"}
                data-success={showOptimizeSuccess ? "true" : "false"}
              >
                {isLoading ? (
                  <span className={responsiveStyles.spinnerWhite} aria-hidden="true" />
                ) : (
                  <SyncIcon />
                )}
                {isLoading ? "Optimizing..." : hasResult ? "Re-optimize Route" : "Optimize Route"}
              </button>
            )}
          </div>
          {/* Collapse control — separated from CTA */}
          <button
            type="button"
            aria-label={isExpanded ? "Collapse client search" : "Expand client search"}
            onClick={() => onSetExpanded(!isExpanded)}
            className={`${responsiveStyles.panelChevronButton} ml-3`}
          >
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
              {isExpanded ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isCollapsedDesktop && selectedDestinations.length > 0 && (
        <p className="m-0 mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
          {previewNamesText}
          {extraCount > 0 && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onSetExpanded(true)}
                className={responsiveStyles.collapsedPreviewButton}
              >
                +{extraCount} more
              </button>
            </>
          )}
        </p>
      )}

      {isContentVisible && (
        <>
          <div className={responsiveStyles.patientSelectionGrid}>
            <div className="grid gap-2">
              <div className="flex min-h-10 items-start">
                <p className={responsiveStyles.patientColumnLabel}>
                  Search clients · {destinationSearchResults.length}
                </p>
              </div>
              <div className={responsiveStyles.patientSearchContainer}>
                {createPatientError && (
                  <p className={responsiveStyles.inlineErrorBanner}>{createPatientError}</p>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      id="destination-patient-search"
                      type="search"
                      aria-label="Destination client search"
                      value={destinationSearchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      placeholder="Search by first or last name"
                      className={`${responsiveStyles.searchInputCompact} pl-9 sm:pl-10`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCreatePatient}
                    aria-label="Add Client"
                    className={responsiveStyles.addClientButton}
                  >
                    <PlusIcon />
                    Add
                  </button>
                </div>
                {isSearchLoading && (
                  <p className={responsiveStyles.panelEmptyText}>Loading clients…</p>
                )}
                {searchError && (
                  <p className="m-0 text-xs text-amber-700 dark:text-amber-300">{searchError}</p>
                )}
                {destinationSearchResults.length > 0 && (
                  <ul
                    className={responsiveStyles.selectableList}
                    style={isMobileViewport ? { maxHeight: mobileSearchListMaxHeight } : undefined}
                  >
                    {destinationSearchResults.map((patient) => {
                      const patientName = formatPatientNameFromParts(
                        patient.firstName,
                        patient.lastName,
                      );
                      const isInRoute = inRoutePatientIds.has(patient.id);
                      return (
                        <li key={patient.id} className="pr-2">
                          <div
                            className={`${responsiveStyles.routeClientCard} ${
                              isInRoute ? responsiveStyles.routeClientCardSelected : ""
                            }`}
                          >
                            <span className={responsiveStyles.clientAvatar} aria-hidden="true">
                              {getPatientInitials(patient.firstName, patient.lastName)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={responsiveStyles.routeClientName}>{patientName}</p>
                              <p className={responsiveStyles.routeClientAddress}>
                                {patient.address}
                              </p>
                            </div>
                            {isInRoute ? (
                              <span className={responsiveStyles.routeInRouteBadge}>
                                <CheckIcon />
                                In route
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAddPatient(patient)}
                                aria-label={`Add ${patientName}`}
                                title={`Add ${patientName}`}
                                className={responsiveStyles.routeAddClientButton}
                              >
                                <PlusIcon />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className={responsiveStyles.selectedRouteColumn}>
              <SelectedDestinationsSection
                isMobileViewport={isMobileViewport}
                isLoading={isVisitInstancesLoading}
                autoSeedHint={autoSeedHint}
                startAddress={startAddress}
                endAddress={resolvedEndAddress}
                planningDate={planningDate}
                selectedDestinations={selectedDestinations}
                expandedDestinationVisitKeys={expandedDestinationVisitKeys}
                onToggleDestinationDetails={onToggleDestinationDetails}
                onClearSelectedDestinations={onClearSelectedDestinations}
                onRemoveDestinationVisit={onRemoveDestinationVisit}
                onSetDestinationVisitIncluded={onSetDestinationVisitIncluded}
                onUpdateDestinationPlanningWindow={onUpdateDestinationPlanningWindow}
                onSetDestinationPersistPlanningWindow={onSetDestinationPersistPlanningWindow}
                activeVisitInstanceActionId={activeVisitInstanceActionId}
                onVisitInstanceStatusChange={onVisitInstanceStatusChange}
                onVisitInstanceReschedule={onVisitInstanceReschedule}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
};
