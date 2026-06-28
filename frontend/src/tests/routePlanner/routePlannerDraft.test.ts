import { describe, expect, it } from "vitest";
import {
  ROUTE_PLANNER_DRAFT_STORAGE_KEY,
  clearRoutePlannerDraft,
  parseRoutePlannerDraftDestinationState,
  persistRoutePlannerDraft,
  readRoutePlannerDraft,
  type RoutePlannerDraft,
} from "../../features/route-planner/state/routePlannerDraft";

const draftDestinationState = {
  visitKey: "visit-1",
  sourceWindowId: "window-1",
  patientId: "patient-1",
  isIncluded: true,
  persistPlanningWindow: false,
};

const validDraft: RoutePlannerDraft = {
  version: 1,
  selectedDestinationStates: [draftDestinationState],
};

describe("routePlannerDraft", () => {
  it("parses a valid selected destination state", () => {
    expect(parseRoutePlannerDraftDestinationState(draftDestinationState)).toEqual(
      draftDestinationState,
    );
  });

  it("rejects invalid selected destination states", () => {
    expect(parseRoutePlannerDraftDestinationState(null)).toBeNull();
    expect(
      parseRoutePlannerDraftDestinationState({
        ...draftDestinationState,
        patientId: 123,
      }),
    ).toBeNull();
    expect(
      parseRoutePlannerDraftDestinationState({
        ...draftDestinationState,
        sourceWindowId: 101,
      }),
    ).toBeNull();
    expect(
      parseRoutePlannerDraftDestinationState({
        ...draftDestinationState,
        persistPlanningWindow: "yes",
      }),
    ).toBeNull();
  });

  it("returns null for missing or invalid stored drafts", () => {
    window.localStorage.removeItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY);
    expect(readRoutePlannerDraft()).toBeNull();

    window.localStorage.setItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY, "{bad json");
    expect(readRoutePlannerDraft()).toBeNull();

    window.localStorage.setItem(
      ROUTE_PLANNER_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...validDraft, version: 2 }),
    );
    expect(readRoutePlannerDraft()).toBeNull();

    window.localStorage.setItem(
      ROUTE_PLANNER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...validDraft,
        selectedDestinationStates: [{ ...draftDestinationState, patientId: 123 }],
      }),
    );
    expect(readRoutePlannerDraft()).toBeNull();
  });

  it("persists, reads, and clears a valid draft", () => {
    persistRoutePlannerDraft(validDraft);
    expect(readRoutePlannerDraft()).toEqual(validDraft);

    clearRoutePlannerDraft();
    expect(window.localStorage.getItem(ROUTE_PLANNER_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("ignores a legacy activeMobileStep field (step-wizard removed)", () => {
    window.localStorage.setItem(
      ROUTE_PLANNER_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...validDraft, activeMobileStep: "review" }),
    );
    // Legacy drafts still parse; the stale field is dropped, not rejected.
    expect(readRoutePlannerDraft()).toEqual(validDraft);
  });
});
