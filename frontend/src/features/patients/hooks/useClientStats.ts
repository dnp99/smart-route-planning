import { useMemo } from "react";
import type { Patient } from "../../../../../shared/contracts";
import { computeClientStats, type ClientStats } from "../domain/clientStats";

/** Memoized summary metrics for the clients list (Total / Fixed / Flexible / Avg duration). */
export const useClientStats = (patients: Patient[]): ClientStats =>
  useMemo(() => computeClientStats(patients), [patients]);
