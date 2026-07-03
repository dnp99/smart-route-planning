import { describe, expect, it } from "vitest";
import {
  buildSelectedDestinationsFromResult,
  comparePatientsByName,
  formatPatientListLabel,
  toSelectedPatientDestinations,
} from "../../features/route-planner/domain/routePlannerHelpers";
import type { OptimizeRouteResponse } from "../../components/types";
import type { Patient } from "../../../../shared/contracts";
import type { SelectedPatientDestination } from "../../features/route-planner/domain/routePlannerTypes";

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

describe("comparePatientsByName", () => {
  it("sorts A→Z by first name, then last name, case-insensitively", () => {
    const patients = [
      buildPatient({ id: "1", firstName: "wow", lastName: "Hey" }),
      buildPatient({ id: "2", firstName: "Test", lastName: "Test" }),
      buildPatient({ id: "3", firstName: "Jing", lastName: "S" }),
      buildPatient({ id: "4", firstName: "Test2", lastName: "45" }),
      buildPatient({ id: "5", firstName: "test", lastName: "Alpha" }),
    ];

    const ordered = [...patients].sort(comparePatientsByName).map((patient) => patient.id);

    // Jing, then the two "Test" first names (Alpha < Test on last name,
    // case-insensitively), then Test2, then wow.
    expect(ordered).toEqual(["3", "5", "2", "4", "1"]);
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
    expect(formatPatientListLabel([])).toBe("selected clients");
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

describe("buildSelectedDestinationsFromResult", () => {
  const buildResult = (): OptimizeRouteResponse =>
    ({
      timezone: "America/Toronto",
      start: { address: "Home", coords: { lat: 43.6, lon: -79.5 }, departureTime: "" },
      end: { address: "Home", coords: { lat: 43.6, lon: -79.5 } },
      orderedStops: [
        {
          stopId: "s1",
          address: "10 First Ave",
          coords: { lat: 43.7, lon: -79.7 },
          arrivalTime: "",
          departureTime: "",
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 60,
          isEndingPoint: false,
          tasks: [
            {
              visitId: "v-yasmin-am",
              patientId: "yasmin",
              patientName: "Yasmin Ramji",
              address: "10 First Ave",
              windowStart: "08:40",
              windowEnd: "08:55",
              windowType: "fixed",
              serviceDurationMinutes: 15,
              arrivalTime: "",
              serviceStartTime: "",
              serviceEndTime: "",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
        },
        {
          stopId: "s2",
          address: "22 Second St",
          coords: { lat: 43.71, lon: -79.71 },
          arrivalTime: "",
          departureTime: "",
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 120,
          isEndingPoint: false,
          tasks: [
            {
              visitId: "v-nasim",
              patientId: "nasim",
              patientName: "Nasim Akhter",
              address: "22 Second St",
              windowStart: "09:00",
              windowEnd: "11:00",
              windowType: "flexible",
              serviceDurationMinutes: 20,
              arrivalTime: "",
              serviceStartTime: "",
              serviceEndTime: "",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
        },
        {
          stopId: "end",
          address: "Home",
          coords: { lat: 43.6, lon: -79.5 },
          arrivalTime: "",
          departureTime: "",
          distanceFromPreviousKm: 3,
          durationFromPreviousSeconds: 180,
          isEndingPoint: true,
          tasks: [],
        },
      ],
      routeLegs: [],
      unscheduledTasks: [
        {
          visitId: "v-kenneth",
          patientId: "kenneth",
          reason: "insufficient_day_capacity",
          patientName: "Kenneth Clark",
          address: "99 Late Rd",
          windowStart: "10:00",
          windowEnd: "10:30",
          windowType: "fixed",
        },
      ],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
      },
      algorithmVersion: "v3",
    }) as OptimizeRouteResponse;

  it("rebuilds the selection from scheduled and unscheduled visits (skips the ending stop)", () => {
    const destinations = buildSelectedDestinationsFromResult(buildResult());

    expect(destinations.map((d) => d.patientId)).toEqual(["yasmin", "nasim", "kenneth"]);
    expect(destinations.every((d) => d.isIncluded)).toBe(true);

    const yasmin = destinations[0];
    expect(yasmin.visitId).toBe("v-yasmin-am");
    expect(yasmin.visitKey).toBe("yasmin:result:v-yasmin-am");
    expect(yasmin.windowStart).toBe("08:40");
    expect(yasmin.windowEnd).toBe("08:55");
    expect(yasmin.windowType).toBe("fixed");
    expect(yasmin.serviceDurationMinutes).toBe(15);

    // Unscheduled visits are preserved too (they were part of the plan).
    expect(destinations[2].patientId).toBe("kenneth");
    expect(destinations[2].address).toBe("99 Late Rd");
  });

  it("returns an empty list for a result with no visits", () => {
    const empty = buildSelectedDestinationsFromResult({
      ...buildResult(),
      orderedStops: [],
      unscheduledTasks: [],
    });
    expect(empty).toEqual([]);
  });
});
