import { responsiveStyles } from "../responsiveStyles";
import { DestinationRow } from "./DestinationRow";
import type { SelectedPatientDestination } from "./routePlannerTypes";

type SelectedDestinationsSectionProps = {
  selectedDestinations: SelectedPatientDestination[];
  expandedDestinationVisitKeys: Record<string, boolean>;
  onToggleDestinationDetails: (visitKey: string) => void;
  onRemoveDestinationVisit: (visitKey: string) => void;
  onSetDestinationVisitIncluded: (visitKey: string, isIncluded: boolean) => void;
  onUpdateDestinationPlanningWindow: (visitKey: string, field: "windowStart" | "windowEnd", value: string) => void;
  onSetDestinationPersistPlanningWindow: (visitKey: string, persistPlanningWindow: boolean) => void;
};

export const SelectedDestinationsSection = ({
  selectedDestinations,
  expandedDestinationVisitKeys,
  onToggleDestinationDetails,
  onRemoveDestinationVisit,
  onSetDestinationVisitIncluded,
  onUpdateDestinationPlanningWindow,
  onSetDestinationPersistPlanningWindow,
}: SelectedDestinationsSectionProps) => {
  return (
    <div className="grid gap-2">
      <p className={responsiveStyles.patientColumnLabel}>
        Selected ({selectedDestinations.length})
      </p>
      <div className={responsiveStyles.destinationList}>
        {selectedDestinations.length === 0 ? (
          <p className={responsiveStyles.panelEmptyText}>No patients selected yet.</p>
        ) : (
          <ol className="m-0 divide-y divide-slate-100 dark:divide-slate-800">
            {selectedDestinations.map((destination, index) => (
              <DestinationRow
                key={destination.visitKey}
                destination={destination}
                index={index}
                isExpanded={expandedDestinationVisitKeys[destination.visitKey] ?? false}
                onToggleDetails={() => onToggleDestinationDetails(destination.visitKey)}
                onRemove={() => onRemoveDestinationVisit(destination.visitKey)}
                onSetIncluded={(v) => onSetDestinationVisitIncluded(destination.visitKey, v)}
                onUpdateWindow={(field, value) => onUpdateDestinationPlanningWindow(destination.visitKey, field, value)}
                onSetPersistWindow={(v) => onSetDestinationPersistPlanningWindow(destination.visitKey, v)}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
