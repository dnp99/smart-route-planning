import type { Patient } from "../../../../../shared/contracts";
import { resolveVisitTypeLabel } from "./visitType";

export type ClientStats = {
  total: number;
  fixed: number;
  flexible: number;
  avgDuration: number;
};

/**
 * Summary metrics for the clients list. `fixed`/`flexible` use the same
 * classifier as the table tabs, so a "mixed" client counts toward neither and
 * `fixed + flexible` can be less than `total`. `avgDuration` is rounded minutes.
 */
export const computeClientStats = (patients: Patient[]): ClientStats => {
  const total = patients.length;
  const fixed = patients.filter((patient) => resolveVisitTypeLabel(patient) === "fixed").length;
  const flexible = patients.filter(
    (patient) => resolveVisitTypeLabel(patient) === "flexible",
  ).length;
  const avgDuration = total
    ? Math.round(patients.reduce((sum, patient) => sum + patient.visitDurationMinutes, 0) / total)
    : 0;

  return { total, fixed, flexible, avgDuration };
};
