import { useEffect, useMemo, useState } from "react";
import type { Patient, VisitInstance } from "../../../../../shared/contracts";
import type { SelectedPatientDestination } from "../domain/routePlannerTypes";
import {
  toSelectedPatientDestinations,
  toSelectedVisitInstanceDestinations,
} from "../domain/routePlannerHelpers";

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

  const addDestinationPatient = (patient: Patient, visitInstances?: VisitInstance[]) => {
    const hasInstances = Array.isArray(visitInstances) && visitInstances.length > 0;
    const destinations = hasInstances
      ? toSelectedVisitInstanceDestinations(patient, visitInstances)
      : toSelectedPatientDestinations(patient);
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

  const replaceSelectedDestinations = (destinations: SelectedPatientDestination[]) => {
    setSelectedDestinations(destinations);
    setExpandedDestinationVisitKeys(
      Object.fromEntries(destinations.map((destination) => [destination.visitKey, false])),
    );
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
    replaceSelectedDestinations,
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
