import type { Patient } from "../../../../../shared/contracts";

export type VisitTypeLabel = "fixed" | "flexible" | "mixed";

/** Window filter selection for the clients list (All / Fixed / Flexible). */
export type WindowFilter = "all" | "fixed" | "flexible";

/**
 * Classifies a client as fixed / flexible / mixed from its visit windows
 * (falling back to the legacy `visitTimeType` when no windows are present).
 * Shared by the clients table filter tabs and the summary stats so the counts
 * always agree.
 */
export const resolveVisitTypeLabel = (patient: Patient): VisitTypeLabel => {
  const windows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (windows.length === 0) {
    return patient.visitTimeType === "flexible" ? "flexible" : "fixed";
  }

  const visitTypes = new Set(windows.map((window) => window.visitTimeType));
  if (visitTypes.size > 1) {
    return "mixed";
  }

  return visitTypes.has("flexible") ? "flexible" : "fixed";
};
