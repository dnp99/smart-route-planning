export const ROUTE_PLANNER_DRAFT_STORAGE_KEY = "careflow.route-planner.draft.v1";

export type MobilePlannerStep = "trip" | "patients" | "review";

export type RoutePlannerDraft = {
  version: 1;
  activeMobileStep: MobilePlannerStep;
  selectedDestinationStates: RoutePlannerDraftDestinationState[];
  planningDate?: string;
};

export type RoutePlannerDraftDestinationState = {
  visitKey: string;
  sourceWindowId: string | null;
  patientId: string;
  isIncluded: boolean;
  persistPlanningWindow: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMobilePlannerStep = (value: unknown): value is MobilePlannerStep =>
  value === "trip" || value === "patients" || value === "review";

export const parseRoutePlannerDraftDestinationState = (
  value: unknown,
): RoutePlannerDraftDestinationState | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.visitKey !== "string" ||
    (value.sourceWindowId !== null && typeof value.sourceWindowId !== "string") ||
    typeof value.patientId !== "string" ||
    typeof value.isIncluded !== "boolean" ||
    typeof value.persistPlanningWindow !== "boolean"
  ) {
    return null;
  }

  return {
    visitKey: value.visitKey,
    sourceWindowId: value.sourceWindowId,
    patientId: value.patientId,
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

    if (!isMobilePlannerStep(parsed.activeMobileStep)) {
      return null;
    }

    const rawDestinationStates = Array.isArray(parsed.selectedDestinationStates)
      ? parsed.selectedDestinationStates
      : Array.isArray(parsed.selectedDestinations)
        ? parsed.selectedDestinations
        : null;
    if (!rawDestinationStates) {
      return null;
    }

    const selectedDestinationStates = rawDestinationStates
      .map(parseRoutePlannerDraftDestinationState)
      .filter(
        (destination): destination is RoutePlannerDraftDestinationState => destination !== null,
      );

    if (selectedDestinationStates.length !== rawDestinationStates.length) {
      return null;
    }

    return {
      version: 1,
      activeMobileStep: parsed.activeMobileStep,
      selectedDestinationStates,
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

  window.localStorage.setItem(
    ROUTE_PLANNER_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      activeMobileStep: draft.activeMobileStep,
      selectedDestinationStates: draft.selectedDestinationStates,
      ...(typeof draft.planningDate === "string" ? { planningDate: draft.planningDate } : {}),
    }),
  );
};

export const clearRoutePlannerDraft = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
};
