import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routeOptimizationState } = vi.hoisted(() => ({
  routeOptimizationState: {
    result: null as unknown,
    error: "",
    isLoading: false,
    showOptimizeSuccess: false,
    showOptimizeFlash: false,
    hasAttemptedOptimize: false,
  },
}));

const optimizeRouteMock = vi.fn();
const persistPlanningWindowsMock = vi.fn();
const createPatientMock = vi.fn();
const usePatientSearchMock = vi.fn<
  (args: { query: string; enabled: boolean }) => {
    patients: unknown[];
    isLoading: boolean;
    error: string;
  }
>(() => ({
  patients: [],
  isLoading: false,
  error: "",
}));

vi.mock("../../components/hooks/useRouteOptimization", () => ({
  useRouteOptimization: () => ({
    result: routeOptimizationState.result,
    error: routeOptimizationState.error,
    isLoading: routeOptimizationState.isLoading,
    showOptimizeSuccess: routeOptimizationState.showOptimizeSuccess,
    showOptimizeFlash: routeOptimizationState.showOptimizeFlash,
    hasAttemptedOptimize: routeOptimizationState.hasAttemptedOptimize,
    optimizeRoute: optimizeRouteMock,
  }),
}));

vi.mock("../../components/hooks/usePatientSearch", () => ({
  usePatientSearch: (args: { enabled: boolean }) => usePatientSearchMock(args),
}));

vi.mock("../../components/routePlanner/routePlannerService", () => ({
  persistPlanningWindows: (...args: unknown[]) => persistPlanningWindowsMock(...args),
}));

vi.mock("../../components/patients/patientService", () => ({
  createPatient: (...args: unknown[]) => createPatientMock(...args),
}));

vi.mock("../../components/AddressAutocompleteInput", () => ({
  default: ({
    id,
    label,
    value,
    onChange,
    onSuggestionPick,
    disabled,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSuggestionPick?: (suggestion: { displayName: string; placeId: string }) => void;
    disabled?: boolean;
  }) => {
    const suggestion =
      id === "startAddress"
        ? {
            displayName: "3361 Ingram Road, Mississauga, ON",
            placeId: "start-place",
          }
        : {
            displayName: "6625 Snow Goose Lane, Mississauga, ON",
            placeId: "end-place",
          };

    return (
      <div>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          value={value}
          disabled={Boolean(disabled)}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
        />
        {onSuggestionPick && (
          <button
            type="button"
            disabled={Boolean(disabled)}
            onClick={() => {
              onChange(suggestion.displayName);
              onSuggestionPick(suggestion);
            }}
          >
            Pick {label}
          </button>
        )}
      </div>
    );
  },
}));

vi.mock("../../components/RouteMap", () => ({
  default: () => null,
}));

import RoutePlanner from "../../components/RoutePlanner";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const janePatient = {
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: "place-1",
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "11:00:00",
  visitTimeType: "fixed" as const,
  visitWindows: [
    {
      id: "window-1",
      startTime: "09:00:00",
      endTime: "11:00:00",
      visitTimeType: "fixed" as const,
    },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const johnPatient = {
  id: "patient-2",
  nurseId: "nurse-1",
  firstName: "John",
  lastName: "Smith",
  address: "456 Queen St",
  googlePlaceId: null,
  visitDurationMinutes: 45,
  preferredVisitStartTime: "10:00:00",
  preferredVisitEndTime: "12:00:00",
  visitTimeType: "flexible" as const,
  visitWindows: [
    {
      id: "window-2",
      startTime: "10:00:00",
      endTime: "12:00:00",
      visitTimeType: "flexible" as const,
    },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const flexNoWindowPatient = {
  id: "patient-3",
  nurseId: "nurse-1",
  firstName: "Flex",
  lastName: "Patient",
  address: "789 King St",
  googlePlaceId: null,
  visitDurationMinutes: 25,
  preferredVisitStartTime: "00:00:00",
  preferredVisitEndTime: "23:59:00",
  visitTimeType: "flexible" as const,
  visitWindows: [],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const multiWindowPatient = {
  id: "patient-4",
  nurseId: "nurse-1",
  firstName: "Mina",
  lastName: "Lee",
  address: "900 Lakeshore Rd",
  googlePlaceId: "place-4",
  visitDurationMinutes: 60,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "10:00:00",
  visitTimeType: "fixed" as const,
  visitWindows: [
    {
      id: "window-4a",
      startTime: "09:00:00",
      endTime: "10:00:00",
      visitTimeType: "fixed" as const,
    },
    {
      id: "window-4b",
      startTime: "13:00:00",
      endTime: "14:00:00",
      visitTimeType: "fixed" as const,
    },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const buildResultWithSingleScheduledStop = () => ({
  start: {
    address: "3361 Ingram Road, Mississauga, ON",
    coords: { lat: 43.527, lon: -79.707 },
    departureTime: "2026-03-14T00:00:00.000Z",
  },
  end: {
    address: "Airport",
    coords: { lat: 43.6777, lon: -79.6248 },
  },
  orderedStops: [
    {
      stopId: "stop-1",
      address: "123 Main St",
      coords: { lat: 43.58, lon: -79.77 },
      arrivalTime: "2026-03-14T08:17:00.000Z",
      departureTime: "2026-03-14T08:47:00.000Z",
      tasks: [
        {
          visitId: "visit-1-patient-1",
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          windowStart: "08:30",
          windowEnd: "09:00",
          windowType: "fixed" as const,
          serviceDurationMinutes: 30,
          arrivalTime: "2026-03-14T08:17:00.000Z",
          serviceStartTime: "2026-03-14T08:30:00.000Z",
          serviceEndTime: "2026-03-14T09:00:00.000Z",
          waitSeconds: 780,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
      distanceFromPreviousKm: 13.49,
      durationFromPreviousSeconds: 780,
    },
    {
      stopId: "stop-2",
      address: "Airport",
      coords: { lat: 43.6777, lon: -79.6248 },
      arrivalTime: "2026-03-14T09:10:00.000Z",
      departureTime: "2026-03-14T09:10:00.000Z",
      tasks: [],
      distanceFromPreviousKm: 10,
      durationFromPreviousSeconds: 600,
      isEndingPoint: true,
    },
  ],
  routeLegs: [
    {
      fromStopId: "start",
      toStopId: "stop-1",
      fromAddress: "3361 Ingram Road, Mississauga, ON",
      toAddress: "123 Main St",
      distanceMeters: 13490,
      durationSeconds: 780,
      encodedPolyline: "abc",
    },
  ],
  unscheduledTasks: [],
  metrics: {
    fixedWindowViolations: 0,
    totalLateSeconds: 0,
    totalWaitSeconds: 780,
    totalDistanceMeters: 23490,
    totalDistanceKm: 23.49,
    totalDurationSeconds: 1380,
  },
  algorithmVersion: "v2.2.2-window-distance-duration-gap-fill",
});

describe("RoutePlanner patient selection integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    optimizeRouteMock.mockReset();
    persistPlanningWindowsMock.mockReset();
    createPatientMock.mockReset();
    persistPlanningWindowsMock.mockResolvedValue(undefined);
    createPatientMock.mockResolvedValue({
      id: "patient-5",
      nurseId: "nurse-1",
      firstName: "New",
      lastName: "Patient",
      address: "99 Test Ave",
      googlePlaceId: null,
      visitDurationMinutes: 30,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "10:00:00",
      visitTimeType: "fixed",
      visitWindows: [
        {
          id: "window-5",
          startTime: "09:00:00",
          endTime: "10:00:00",
          visitTimeType: "fixed",
        },
      ],
      createdAt: "2026-03-12T12:00:00.000Z",
      updatedAt: "2026-03-12T12:00:00.000Z",
    });
    routeOptimizationState.result = null;
    routeOptimizationState.error = "";
    routeOptimizationState.isLoading = false;
    routeOptimizationState.showOptimizeSuccess = false;
    routeOptimizationState.showOptimizeFlash = false;
    routeOptimizationState.hasAttemptedOptimize = false;
    usePatientSearchMock.mockReset();
    usePatientSearchMock.mockImplementation(({ enabled }: { query: string; enabled: boolean }) => ({
      patients: enabled ? [janePatient, johnPatient, flexNoWindowPatient, multiWindowPatient] : [],
      isLoading: false,
      error: "",
    }));
  });

  afterEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("prefills start and end addresses from nurse home address", () => {
    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Starting point")).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
    expect(screen.getByLabelText("Ending point")).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
  });

  it("keeps draft trip values over nurse home address defaults", () => {
    window.localStorage.setItem(
      "careflow.route-planner.draft.v1",
      JSON.stringify({
        version: 1,
        startAddress: "Draft Start",
        manualEndAddress: "Draft End",
        startGooglePlaceId: null,
        manualEndGooglePlaceId: null,
        endMode: "manual",
        activeMobileStep: "trip",
        selectedDestinations: [],
        selectedEndPatient: null,
      }),
    );

    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Starting point")).toHaveProperty("value", "Draft Start");
    expect(screen.getByLabelText("Ending point")).toHaveProperty("value", "Draft End");
  });

  it("adds destination patients and prevents duplicate selection", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByRole("button", { name: "Edit window" })).toBeTruthy();
    expect(screen.queryByText("Include this visit in route")).toBeNull();
    // Jane Doe button in the search results list should be gone (duplicate prevention);
    // only the destination row name button (title="Jane Doe") should remain
    expect(screen.getAllByRole("button", { name: /^Jane Doe$/i })).toHaveLength(1);
  });

  it("shows a clear hint when ending point is not selected", () => {
    render(<RoutePlanner />);

    expect(screen.getByText("Select an ending point to enable route optimization.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Optimize Route" })).toHaveProperty("disabled", true);
  });

  it("expands collapsed patients card when +N more is clicked", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Mina Lee/i })[0]);

    fireEvent.click(screen.getByRole("button", { name: "Collapse patient search" }));

    const moreButton = screen.getByRole("button", { name: "+1 more" });
    expect(moreButton).toBeTruthy();

    fireEvent.click(moreButton);

    expect(screen.getByLabelText("Destination patient search")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+1 more" })).toBeNull();
  });

  it("restores draft selections after remounting route planner", () => {
    const { unmount } = render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    unmount();
    render(<RoutePlanner />);

    expect(screen.getByLabelText("Ending point")).toHaveProperty("value", "Airport");

    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          windowStart: "09:00",
          windowEnd: "11:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("allows route optimization when selected patient windows overlap", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);

    expect(screen.getByRole("button", { name: "Optimize Route" })).toHaveProperty(
      "disabled",
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          windowStart: "09:00",
          windowEnd: "11:00",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
        {
          patientId: "patient-2",
          patientName: "John Smith",
          address: "456 Queen St",
          googlePlaceId: null,
          windowStart: "10:00",
          windowEnd: "12:00",
          windowType: "flexible",
          serviceDurationMinutes: 45,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("shows home-address warning banner and supports account settings action when home address is missing", () => {
    const openAccountSettingsMock = vi.fn();
    render(<RoutePlanner onOpenAccountSettings={openAccountSettingsMock} />);

    expect(screen.getByText("Home address not set")).toBeTruthy();
    expect(
      screen.getByText(
        /Set your home address in Account settings to auto-fill starting and ending points\./i,
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open account settings" }));
    expect(openAccountSettingsMock).toHaveBeenCalledTimes(1);
  });

  it("submits optimize payload with patient-linked destinations", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-2",
          patientName: "John Smith",
          address: "456 Queen St",
          googlePlaceId: null,
          windowStart: "10:00",
          windowEnd: "12:00",
          windowType: "flexible",
          serviceDurationMinutes: 45,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("uses planner-edited windows as plan-only overrides unless save is checked", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));

    fireEvent.change(screen.getByLabelText("Jane Doe start"), {
      target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText("Jane Doe end"), {
      target: { value: "11:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(persistPlanningWindowsMock).not.toHaveBeenCalled();
    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          windowStart: "10:30",
          windowEnd: "11:30",
          windowType: "fixed",
          serviceDurationMinutes: 30,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("hides home-address warning banner when home address exists", () => {
    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    expect(screen.queryByText("Home address not set")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open account settings" })).toBeNull();
  });

  it("creates a new patient from destination card and auto-selects it", async () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Add New Patient" }));
    expect(screen.getByRole("heading", { name: "Add New Patient" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Olivia" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Brown" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "88 Queen Street, Toronto, ON" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new patient" }));

    await waitFor(() => {
      expect(createPatientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Olivia",
          lastName: "Brown",
          address: "88 Queen Street, Toronto, ON",
        }),
      );
    });

    expect(screen.getByText("New Patient")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Add New Patient" })).toBeNull();
  });

  it("submits manual start and end place ids picked from autocomplete", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Pick Starting point" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Ending point" }));
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      startGooglePlaceId: "start-place",
      endAddress: "6625 Snow Goose Lane, Mississauga, ON",
      endGooglePlaceId: "end-place",
      destinations: [],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("hides leave-by suggestion while still rendering planned stop timing details", () => {
    routeOptimizationState.result = buildResultWithSingleScheduledStop();

    render(<RoutePlanner />);

    const janeDetailsToggle = screen.getByRole("button", {
      name: /Toggle details for Jane Doe/i,
    });
    const janeExpectedStartTimeLabel = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date("2026-03-14T08:30:00.000Z"));

    expect(screen.queryByText(/Suggested leave-by:/)).toBeNull();
    expect(screen.queryByText(/Based on a .+ drive to your first visit\./)).toBeNull();
    expect(screen.getByText(/^Expected start$/i).parentElement?.textContent).toContain(
      janeExpectedStartTimeLabel,
    );
    const janeCard = janeDetailsToggle.closest("div");
    if (!janeCard) {
      throw new Error("Expected Jane Doe result card container");
    }
    expect(screen.queryByText(/13\.49 km/)).toBeNull();
    fireEvent.click(janeDetailsToggle);
    expect(screen.getByText(/^Travel$/i).parentElement?.textContent).toContain("13.49 km");
    expect(screen.getAllByText("123 Main St").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("fixed")).toBeTruthy();
    expect(screen.getByText(/^Duration$/i).parentElement?.textContent).toContain("30 min");
    const endingPointDetailsToggle = screen.getByRole("button", {
      name: /Toggle details for Ending point/i,
    });
    const endingPointCard = endingPointDetailsToggle.closest("div");
    if (!endingPointCard) {
      throw new Error("Expected ending point result card container");
    }
    expect(endingPointCard.textContent).toContain("10 km · 10 min from previous stop");

    fireEvent.click(endingPointDetailsToggle);
    expect(screen.getByText("Ending point")).toBeTruthy();
  });

  it("labels ending point as Home when it matches nurse home address and reveals address on toggle", () => {
    routeOptimizationState.result = buildResultWithSingleScheduledStop();

    render(<RoutePlanner nurseHomeAddress="Airport" />);

    expect(screen.getByText("Home")).toBeTruthy();
    const homeEndingPointDetailsToggle = screen.getByRole("button", {
      name: /Toggle details for Home ending point/i,
    });
    const homeEndingPointCard = homeEndingPointDetailsToggle.closest("div");
    if (!homeEndingPointCard) {
      throw new Error("Expected home ending point result card container");
    }
    expect(homeEndingPointCard.textContent).toContain("10 km · 10 min from previous stop");

    fireEvent.click(homeEndingPointDetailsToggle);
    expect(screen.getByText(/^Address$/i).parentElement?.textContent).toContain("Airport");
    expect(screen.getByText("Ending point")).toBeTruthy();
  });

  it("shows expected start time and late warning text from optimized route task timing", () => {
    routeOptimizationState.result = {
      start: {
        address: "3361 Ingram Road, Mississauga, ON",
        coords: { lat: 43.527, lon: -79.707 },
        departureTime: "2026-03-14T00:00:00.000Z",
      },
      end: {
        address: "Airport",
        coords: { lat: 43.6777, lon: -79.6248 },
      },
      orderedStops: [
        {
          stopId: "stop-late",
          address: "456 Queen St",
          coords: { lat: 43.61, lon: -79.7 },
          arrivalTime: "2026-03-14T10:20:00.000Z",
          departureTime: "2026-03-14T10:50:00.000Z",
          tasks: [
            {
              visitId: "visit-late-1",
              patientId: "patient-2",
              patientName: "John Smith",
              address: "456 Queen St",
              googlePlaceId: null,
              windowStart: "09:00",
              windowEnd: "10:00",
              windowType: "fixed",
              serviceDurationMinutes: 30,
              arrivalTime: "2026-03-14T10:20:00.000Z",
              serviceStartTime: "2026-03-14T10:20:00.000Z",
              serviceEndTime: "2026-03-14T10:50:00.000Z",
              waitSeconds: 0,
              lateBySeconds: 1200,
              onTime: false,
            },
          ],
          distanceFromPreviousKm: 20.0,
          durationFromPreviousSeconds: 1900,
        },
      ],
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 1,
        totalLateSeconds: 1200,
        totalWaitSeconds: 0,
        totalDistanceMeters: 20000,
        totalDistanceKm: 20,
        totalDurationSeconds: 1900,
      },
      algorithmVersion: "v2.3.0-matrix-lookahead-unscheduled",
    };

    render(<RoutePlanner />);

    const expectedStartTimeLabel = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date("2026-03-14T10:20:00.000Z"));

    expect(screen.getByText(/^Expected start$/i).parentElement?.textContent).toContain(
      expectedStartTimeLabel,
    );
    expect(screen.getByText(/Outside preferred window by 20 min/i)).toBeTruthy();
  });

  it("shows no preferred window label and suppresses late warning when route task has no preferred window", () => {
    routeOptimizationState.result = {
      start: {
        address: "3361 Ingram Road, Mississauga, ON",
        coords: { lat: 43.527, lon: -79.707 },
        departureTime: "2026-03-14T00:00:00.000Z",
      },
      end: {
        address: "Airport",
        coords: { lat: 43.6777, lon: -79.6248 },
      },
      orderedStops: [
        {
          stopId: "stop-flex",
          address: "789 King St",
          coords: { lat: 43.61, lon: -79.7 },
          arrivalTime: "2026-03-14T08:10:00.000Z",
          departureTime: "2026-03-14T08:35:00.000Z",
          tasks: [
            {
              visitId: "visit-flex-1",
              patientId: "patient-3",
              patientName: "Flex Patient",
              address: "789 King St",
              googlePlaceId: null,
              windowStart: "",
              windowEnd: "",
              windowType: "flexible",
              serviceDurationMinutes: 25,
              arrivalTime: "2026-03-14T08:10:00.000Z",
              serviceStartTime: "2026-03-14T08:10:00.000Z",
              serviceEndTime: "2026-03-14T08:35:00.000Z",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
          distanceFromPreviousKm: 3.0,
          durationFromPreviousSeconds: 600,
        },
      ],
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 3000,
        totalDistanceKm: 3,
        totalDurationSeconds: 600,
      },
      algorithmVersion: "v2.2.4-no-preferred-window-autoscheduling",
    };

    render(<RoutePlanner />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Toggle details for Flex Patient/i,
      }),
    );
    expect(screen.queryByText(/Outside preferred window by/i)).toBeNull();
  });

  it("removes selected destination patient from planner state", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);

    fireEvent.click(screen.getByRole("button", { name: /Remove John Smith/i }));

    expect(screen.getByText("No patients selected yet.")).toBeTruthy();
  });

  it("allows optimizing flexible patients without preferred windows", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-3",
          patientName: "Flex Patient",
          address: "789 King St",
          googlePlaceId: null,
          windowStart: "",
          windowEnd: "",
          windowType: "flexible",
          serviceDurationMinutes: 25,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("requires both window boundaries when nurse partially sets a flexible window", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    fireEvent.change(screen.getByLabelText("Flex Patient start"), {
      target: { value: "13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Set both start and end time (or clear both) before optimizing for: Flex Patient.",
      ),
    ).toBeTruthy();
  });

  it("allows excluding individual patient windows from a multi-window patient", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Mina Lee/i })[0]);
    for (const toggle of screen.getAllByRole("button", { name: "Edit window" })) {
      fireEvent.click(toggle);
    }

    const includeCheckboxes = screen.getAllByRole("checkbox", {
      name: "Include this visit in route",
    });
    expect(includeCheckboxes).toHaveLength(2);
    fireEvent.click(includeCheckboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-4",
          patientName: "Mina Lee",
          address: "900 Lakeshore Rd",
          googlePlaceId: "place-4",
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          serviceDurationMinutes: 60,
        },
      ],
      canOptimize: true,
      planningDate: expect.any(String),
      workingHours: null,
      optimizationObjective: "distance",
    });
  });

  it("can persist planner-entered windows for flexible no-window patients", async () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));

    fireEvent.change(screen.getByLabelText("Flex Patient start"), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText("Flex Patient end"), {
      target: { value: "14:00" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Save this window to patient record" }));

    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    await waitFor(() => {
      expect(persistPlanningWindowsMock).toHaveBeenCalledWith([
        {
          patientId: "patient-3",
          sourceWindowId: null,
          startTime: "13:00",
          endTime: "14:00",
          visitTimeType: "flexible",
        },
      ]);
    });

    await waitFor(() => {
      expect(optimizeRouteMock).toHaveBeenCalledWith({
        startAddress: "3361 Ingram Road, Mississauga, ON",
        endAddress: "Airport",
        destinations: [
          {
            patientId: "patient-3",
            patientName: "Flex Patient",
            address: "789 King St",
            googlePlaceId: null,
            windowStart: "13:00",
            windowEnd: "14:00",
            windowType: "flexible",
            serviceDurationMinutes: 25,
          },
        ],
        canOptimize: true,
        planningDate: expect.any(String),
        workingHours: null,
        optimizationObjective: "distance",
      });
    });
  });
});
