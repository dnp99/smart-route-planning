import { describe, expect, it } from "vitest";
import {
  formatPatientListLabel,
  toSelectedPatientDestinations,
} from "../../components/routePlanner/routePlannerHelpers";
import type { Patient } from "../../../../shared/contracts";
import type { SelectedPatientDestination } from "../../components/routePlanner/routePlannerTypes";

const buildPatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: null,
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "10:00:00",
  visitTimeType: "fixed",
  visitWindows: [],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
  ...overrides,
});

describe("toSelectedPatientDestinations", () => {
  it("maps legacy fixed patient (no visit windows) to a single destination", () => {
    const patient = buildPatient({
      visitTimeType: "fixed",
      visitWindows: [],
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "10:00:00",
    });

    const result = toSelectedPatientDestinations(patient);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      visitKey: "patient-1:legacy",
      sourceWindowId: null,
      patientId: "patient-1",
      windowStart: "09:00",
      windowEnd: "10:00",
      windowType: "fixed",
      requiresPlanningWindow: false,
      isIncluded: true,
    });
  });

  it("maps flexible patient with no visit windows to a planning-window destination", () => {
    const patient = buildPatient({ visitTimeType: "flexible", visitWindows: [] });

    const result = toSelectedPatientDestinations(patient);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      visitKey: "patient-1:planning-window",
      windowStart: "",
      windowEnd: "",
      windowType: "flexible",
      requiresPlanningWindow: true,
    });
  });

  it("maps patient with visit windows to one destination per window", () => {
    const patient = buildPatient({
      visitWindows: [
        { id: "window-1", startTime: "08:30:00", endTime: "09:00:00", visitTimeType: "fixed" },
        { id: "window-2", startTime: "14:00:00", endTime: "14:30:00", visitTimeType: "flexible" },
      ],
    });

    const result = toSelectedPatientDestinations(patient);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      visitKey: "patient-1:window-1",
      windowStart: "08:30",
      windowEnd: "09:00",
      windowType: "fixed",
    });
    expect(result[1]).toMatchObject({
      visitKey: "patient-1:window-2",
      windowStart: "14:00",
      windowEnd: "14:30",
      windowType: "flexible",
    });
  });
});

describe("formatPatientListLabel", () => {
  const makeDestination = (patientName: string): SelectedPatientDestination => ({
    visitKey: patientName,
    sourceWindowId: null,
    patientId: patientName,
    patientName,
    address: "123 Main St",
    googlePlaceId: null,
    windowStart: "09:00",
    windowEnd: "10:00",
    windowType: "fixed",
    serviceDurationMinutes: 30,
    requiresPlanningWindow: false,
    isIncluded: true,
    persistPlanningWindow: false,
  });

  it("returns fallback text when destination list is empty", () => {
    expect(formatPatientListLabel([])).toBe("selected patients");
  });

  it("returns the single name when there is one destination", () => {
    expect(formatPatientListLabel([makeDestination("Jane Doe")])).toBe("Jane Doe");
  });

  it("joins two names with 'and'", () => {
    const result = formatPatientListLabel([
      makeDestination("Jane Doe"),
      makeDestination("Bob Smith"),
    ]);
    expect(result).toBe("Jane Doe and Bob Smith");
  });

  it("joins three or more names with commas and a trailing 'and'", () => {
    const result = formatPatientListLabel([
      makeDestination("Alice Brown"),
      makeDestination("Bob Smith"),
      makeDestination("Carol White"),
    ]);
    expect(result).toBe("Alice Brown, Bob Smith, and Carol White");
  });

  it("deduplicates repeated patient names", () => {
    const result = formatPatientListLabel([
      makeDestination("Jane Doe"),
      makeDestination("Jane Doe"),
    ]);
    expect(result).toBe("Jane Doe");
  });
});
