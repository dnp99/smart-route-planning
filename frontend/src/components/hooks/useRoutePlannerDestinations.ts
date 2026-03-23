import { useEffect, useMemo, useState } from "react";
import type { Patient } from "../../../../shared/contracts";
import type { SelectedPatientDestination } from "../routePlanner/routePlannerTypes";
import { toSelectedPatientDestinations } from "../routePlanner/routePlannerHelpers";

type UseRoutePlannerDestinationsParams = {
  initialDestinations?: SelectedPatientDestination[];
};

export function useRoutePlannerDestinations({
  initialDestinations,
}: UseRoutePlannerDestinationsParams) {
  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<SelectedPatientDestination[]>(
    initialDestinations ?? [],
  );
  const [expandedDestinationVisitKeys, setExpandedDestinationVisitKeys] = useState<
    Record<string, boolean>
  >({});

  // Sync expanded keys when destinations change (add/remove)
  useEffect(() => {
    setExpandedDestinationVisitKeys((current) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      selectedDestinations.forEach((destination) => {
        const existing = current[destination.visitKey];
        if (existing === undefined) {
          next[destination.visitKey] = false;
          changed = true;
          return;
        }
        next[destination.visitKey] = existing;
      });

      if (!changed && Object.keys(current).length !== selectedDestinations.length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [selectedDestinations]);

  const addDestinationPatient = (patient: Patient) => {
    const destinations = toSelectedPatientDestinations(patient);
    if (destinations.length === 0) return;

    setSelectedDestinations((current) => {
      if (current.some((entry) => entry.patientId === patient.id)) return current;
      return [...current, ...destinations];
    });
    setExpandedDestinationVisitKeys((current) => {
      const next = { ...current };
      destinations.forEach((destination) => {
        next[destination.visitKey] = false;
      });
      return next;
    });
    setDestinationSearchQuery("");
  };

  const removeDestinationVisit = (visitKey: string) => {
    setSelectedDestinations((current) => current.filter((entry) => entry.visitKey !== visitKey));
    setExpandedDestinationVisitKeys((current) => {
      if (current[visitKey] === undefined) return current;
      const next = { ...current };
      delete next[visitKey];
      return next;
    });
  };

  const toggleDestinationDetails = (visitKey: string) => {
    setExpandedDestinationVisitKeys((current) => ({
      ...current,
      [visitKey]: !(current[visitKey] ?? false),
    }));
  };

  const updateDestinationPlanningWindow = (
    visitKey: string,
    field: "windowStart" | "windowEnd",
    value: string,
  ) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey ? { ...destination, [field]: value } : destination,
      ),
    );
  };

  const setDestinationVisitIncluded = (visitKey: string, isIncluded: boolean) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey ? { ...destination, isIncluded } : destination,
      ),
    );
  };

  const setDestinationPersistPlanningWindow = (
    visitKey: string,
    persistPlanningWindow: boolean,
  ) => {
    setSelectedDestinations((current) =>
      current.map((destination) =>
        destination.visitKey === visitKey ? { ...destination, persistPlanningWindow } : destination,
      ),
    );
  };

  const destinationCount = selectedDestinations.filter((d) => d.isIncluded).length;

  const requestDestinations = useMemo(
    () => selectedDestinations.filter((d) => d.isIncluded),
    [selectedDestinations],
  );

  const selectedDestinationIdSet = useMemo(
    () => new Set(selectedDestinations.map((d) => d.patientId)),
    [selectedDestinations],
  );

  return {
    destinationSearchQuery,
    setDestinationSearchQuery,
    selectedDestinations,
    expandedDestinationVisitKeys,
    addDestinationPatient,
    removeDestinationVisit,
    toggleDestinationDetails,
    updateDestinationPlanningWindow,
    setDestinationVisitIncluded,
    setDestinationPersistPlanningWindow,
    destinationCount,
    requestDestinations,
    selectedDestinationIdSet,
  };
}
