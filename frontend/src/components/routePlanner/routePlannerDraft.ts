import type { SelectedPatientDestination } from "./routePlannerTypes";

export const ROUTE_PLANNER_DRAFT_STORAGE_KEY = "careflow.route-planner.draft.v1";

export type MobilePlannerStep = "trip" | "patients" | "review";

export type RoutePlannerDraft = {
  version: 1;
  startAddress: string;
  manualEndAddress: string;
  startGooglePlaceId: string | null;
  manualEndGooglePlaceId: string | null;
  activeMobileStep: MobilePlannerStep;
  selectedDestinations: SelectedPatientDestination[];
  planningDate?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWindowType = (value: unknown): value is "fixed" | "flexible" =>
  value === "fixed" || value === "flexible";

const isMobilePlannerStep = (value: unknown): value is MobilePlannerStep =>
  value === "trip" || value === "patients" || value === "review";

export const parseSelectedPatientDestination = (
  value: unknown,
): SelectedPatientDestination | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.visitKey !== "string" ||
    (value.sourceWindowId !== null && typeof value.sourceWindowId !== "string") ||
    typeof value.patientId !== "string" ||
    typeof value.patientName !== "string" ||
    typeof value.address !== "string" ||
    (value.googlePlaceId !== null && typeof value.googlePlaceId !== "string") ||
    typeof value.windowStart !== "string" ||
    typeof value.windowEnd !== "string" ||
    !isWindowType(value.windowType) ||
    typeof value.serviceDurationMinutes !== "number" ||
    value.serviceDurationMinutes !== value.serviceDurationMinutes ||
    value.serviceDurationMinutes === Infinity ||
    value.serviceDurationMinutes === -Infinity ||
    typeof value.requiresPlanningWindow !== "boolean" ||
    typeof value.isIncluded !== "boolean" ||
    typeof value.persistPlanningWindow !== "boolean"
  ) {
    return null;
  }

  return {
    visitKey: value.visitKey,
    sourceWindowId: value.sourceWindowId,
    patientId: value.patientId,
    patientName: value.patientName,
    address: value.address,
    googlePlaceId: value.googlePlaceId,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    windowType: value.windowType,
    serviceDurationMinutes: value.serviceDurationMinutes,
    requiresPlanningWindow: value.requiresPlanningWindow,
    isIncluded: value.isIncluded,
    persistPlanningWindow: value.persistPlanningWindow,
  };
};

export const readRoutePlannerDraft = (): RoutePlannerDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    if (
      typeof parsed.startAddress !== "string" ||
      typeof parsed.manualEndAddress !== "string" ||
      (parsed.startGooglePlaceId !== null && typeof parsed.startGooglePlaceId !== "string") ||
      (parsed.manualEndGooglePlaceId !== null &&
        typeof parsed.manualEndGooglePlaceId !== "string") ||
      !isMobilePlannerStep(parsed.activeMobileStep) ||
      !Array.isArray(parsed.selectedDestinations)
    ) {
      return null;
    }

    const selectedDestinations = parsed.selectedDestinations
      .map(parseSelectedPatientDestination)
      .filter((destination): destination is SelectedPatientDestination => destination !== null);

    if (selectedDestinations.length !== parsed.selectedDestinations.length) {
      return null;
    }

    return {
      version: 1,
      startAddress: parsed.startAddress,
      manualEndAddress: parsed.manualEndAddress,
      startGooglePlaceId: parsed.startGooglePlaceId,
      manualEndGooglePlaceId: parsed.manualEndGooglePlaceId,
      activeMobileStep: parsed.activeMobileStep,
      selectedDestinations,
      ...(typeof parsed.planningDate === "string" ? { planningDate: parsed.planningDate } : {}),
    };
  } catch {
    return null;
  }
};

export const persistRoutePlannerDraft = (draft: RoutePlannerDraft): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

export const clearRoutePlannerDraft = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
};
