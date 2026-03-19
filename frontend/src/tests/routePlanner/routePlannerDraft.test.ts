import { describe, expect, it } from "vitest";
import {
  ROUTE_PLANNER_DRAFT_STORAGE_KEY,
  clearRoutePlannerDraft,
  parseSelectedPatientDestination,
  persistRoutePlannerDraft,
  readRoutePlannerDraft,
  type RoutePlannerDraft,
} from "../../components/routePlanner/routePlannerDraft";

const draftDestination = {
  visitKey: "visit-1",
  sourceWindowId: "window-1",
  patientId: "patient-1",
  patientName: "Casey Smith",
  address: "1 Main Street",
  googlePlaceId: "place-1",
  windowStart: "09:00",
  windowEnd: "10:00",
  windowType: "fixed" as const,
  serviceDurationMinutes: 45,
  requiresPlanningWindow: false,
  isIncluded: true,
  persistPlanningWindow: false,
};

const validDraft: RoutePlannerDraft = {
  version: 1,
  startAddress: "Start",
  manualEndAddress: "End",
  startGooglePlaceId: "start-place",
  manualEndGooglePlaceId: null,
  activeMobileStep: "review",
  selectedDestinations: [draftDestination],
};

describe("routePlannerDraft", () => {
  it("parses a valid selected patient destination", () => {
    expect(parseSelectedPatientDestination(draftDestination)).toEqual(draftDestination);
  });

  it("rejects invalid selected patient destinations", () => {
    expect(parseSelectedPatientDestination(null)).toBeNull();
    expect(
      parseSelectedPatientDestination({
        ...draftDestination,
        windowType: "unknown",
      }),
    ).toBeNull();
    expect(
      parseSelectedPatientDestination({
        ...draftDestination,
        serviceDurationMinutes: Number.NaN,
      }),
    ).toBeNull();
    expect(
      parseSelectedPatientDestination({
        ...draftDestination,
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
      JSON.stringify({ ...validDraft, activeMobileStep: "archive" }),
    );
    expect(readRoutePlannerDraft()).toBeNull();

    window.localStorage.setItem(
      ROUTE_PLANNER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...validDraft,
        selectedDestinations: [{ ...draftDestination, serviceDurationMinutes: "45" }],
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
});
