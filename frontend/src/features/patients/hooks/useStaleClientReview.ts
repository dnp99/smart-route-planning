import { useEffect, useState } from "react";
import type { Patient } from "../../../../../shared/contracts";
import { archiveClients, dismissStaleReview, fetchStaleClients } from "../api/patientService";

/**
 * Drives the "clients unused for 30+ days" review prompt: fetches the stale set
 * once, lets the user pick which to archive (soft-delete) or dismiss ("Keep
 * all", which snoozes the prompt server-side). Replaces the old silent
 * auto-archive — the user decides. `onArchived` refreshes the main client list.
 */
export const useStaleClientReview = (onArchived: () => void) => {
  const [staleClients, setStaleClients] = useState<Patient[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchStaleClients()
      .then((review) => {
        if (!active) {
          return;
        }
        setStaleClients(review.patients);
        // Pre-select all — "Archive selected" then clears everything unless the
        // user un-ticks the ones they want to keep.
        setSelectedIds(new Set(review.patients.map((patient) => patient.id)));
      })
      .catch(() => {
        // A failed stale fetch is non-blocking: just show no prompt.
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const archiveSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      const archivedIds = await archiveClients(ids);
      const archivedSet = new Set(archivedIds);
      const remaining = staleClients.filter((patient) => !archivedSet.has(patient.id));
      setStaleClients(remaining);
      setSelectedIds(new Set(remaining.map((patient) => patient.id)));
      if (remaining.length === 0) {
        setIsExpanded(false);
      }
      onArchived();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to archive clients.");
    } finally {
      setIsBusy(false);
    }
  };

  const dismiss = async () => {
    setIsBusy(true);
    setError("");
    try {
      await dismissStaleReview();
      setStaleClients([]);
      setIsExpanded(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to dismiss the review.");
    } finally {
      setIsBusy(false);
    }
  };

  return {
    staleClients,
    isVisible: staleClients.length > 0,
    isExpanded,
    setExpanded: setIsExpanded,
    selectedIds,
    toggleSelect,
    archiveSelected,
    dismiss,
    isBusy,
    error,
  };
};
