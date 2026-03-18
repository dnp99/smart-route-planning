export type SelectedPatientDestination = {
  visitKey: string;
  sourceWindowId: string | null;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: "fixed" | "flexible";
  serviceDurationMinutes: number;
  requiresPlanningWindow: boolean;
  isIncluded: boolean;
  persistPlanningWindow: boolean;
};
