import { responsiveStyles } from "../responsiveStyles";
import { SelectedDestinationsSection } from "./SelectedDestinationsSection";
import type { SelectedPatientDestination } from "./routePlannerTypes";
import type { Patient } from "../../../../shared/contracts";
import { formatPatientNameFromParts } from "../patients/patientName";

type PatientSelectorSectionProps = {
  isVisible: boolean;
  isMobileViewport: boolean;
  isExpanded: boolean;
  onSetExpanded: (v: boolean) => void;
  destinationCount: number;
  destinationSearchResults: Patient[];
  destinationSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isSearchLoading: boolean;
  searchError: string;
  createPatientError: string;
  selectedDestinations: SelectedPatientDestination[];
  expandedDestinationVisitKeys: Record<string, boolean>;
  onAddPatient: (patient: Patient) => void;
  onOpenCreatePatient: () => void;
  onToggleDestinationDetails: (visitKey: string) => void;
  onRemoveDestinationVisit: (visitKey: string) => void;
  onSetDestinationVisitIncluded: (visitKey: string, isIncluded: boolean) => void;
  onUpdateDestinationPlanningWindow: (
    visitKey: string,
    field: "windowStart" | "windowEnd",
    value: string,
  ) => void;
  onSetDestinationPersistPlanningWindow: (visitKey: string, persistPlanningWindow: boolean) => void;
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
  destinationSearchResults,
  destinationSearchQuery,
  onSearchQueryChange,
  isSearchLoading,
  searchError,
  createPatientError,
  selectedDestinations,
  expandedDestinationVisitKeys,
  onAddPatient,
  onOpenCreatePatient,
  onToggleDestinationDetails,
  onRemoveDestinationVisit,
  onSetDestinationVisitIncluded,
  onUpdateDestinationPlanningWindow,
  onSetDestinationPersistPlanningWindow,
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
    isLoading || !canOptimize || (hasResult && !hasChangedSinceLastOptimize);
  const defaultObjectiveLabel =
    defaultOptimizationObjective === "distance" ? "Less driving" : "Finish sooner";
  const routePreferenceControl = (
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
        Less driving
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
        Finish sooner
      </button>
    </div>
  );

  return (
    <section className={responsiveStyles.panel}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className={responsiveStyles.cardTitle}>Patients</h2>
          {destinationCount > 0 && (
            <span className={responsiveStyles.countPill}>{destinationCount}</span>
          )}
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
                {isLoading && <span className={responsiveStyles.spinnerWhite} aria-hidden="true" />}
                {isLoading ? "Optimizing..." : hasResult ? "Re-optimize Route" : "Optimize Route"}
              </button>
            )}
          </div>
          {/* Collapse control — separated from CTA */}
          <button
            type="button"
            aria-label={isExpanded ? "Collapse patient search" : "Expand patient search"}
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
              <p className={responsiveStyles.patientColumnLabel}>
                Search patients ({destinationSearchResults.length})
              </p>
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
                      aria-label="Destination patient search"
                      value={destinationSearchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      placeholder="Search saved patients by first or last name"
                      className={`${responsiveStyles.searchInputCompact} pl-9 sm:pl-10`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCreatePatient}
                    aria-label="Add New Patient"
                    className={`${responsiveStyles.secondaryIconButton} sm:h-auto sm:w-auto sm:px-3 sm:py-1.5`}
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
                      className="h-5 w-5 sm:hidden"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    <span className="hidden sm:inline">Add New Patient</span>
                  </button>
                </div>
                {isSearchLoading && (
                  <p className={responsiveStyles.panelEmptyText}>Loading patients…</p>
                )}
                {searchError && (
                  <p className="m-0 text-xs text-amber-700 dark:text-amber-300">{searchError}</p>
                )}
                {destinationSearchResults.length > 0 && (
                  <ul className={responsiveStyles.selectableList}>
                    {destinationSearchResults.map((patient) => {
                      const patientName = formatPatientNameFromParts(
                        patient.firstName,
                        patient.lastName,
                      );
                      return (
                        <li key={patient.id}>
                          <button
                            type="button"
                            onClick={() => onAddPatient(patient)}
                            className={responsiveStyles.selectableItemButton}
                          >
                            <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">
                              {patientName}
                            </p>
                            <p className="m-0 text-slate-600 dark:text-slate-300">
                              {patient.address}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <SelectedDestinationsSection
              selectedDestinations={selectedDestinations}
              expandedDestinationVisitKeys={expandedDestinationVisitKeys}
              onToggleDestinationDetails={onToggleDestinationDetails}
              onRemoveDestinationVisit={onRemoveDestinationVisit}
              onSetDestinationVisitIncluded={onSetDestinationVisitIncluded}
              onUpdateDestinationPlanningWindow={onUpdateDestinationPlanningWindow}
              onSetDestinationPersistPlanningWindow={onSetDestinationPersistPlanningWindow}
            />
          </div>
        </>
      )}
    </section>
  );
};
