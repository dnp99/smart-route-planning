import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routeOptimizationState } = vi.hoisted(() => ({
  routeOptimizationState: {
    result: null as unknown,
    error: "",
    isLoading: false,
    showOptimizeSuccess: false,
    hasAttemptedOptimize: false,
  },
}));

const optimizeRouteMock = vi.fn();
const persistPlanningWindowsMock = vi.fn();
const usePatientSearchMock = vi.fn<
  (args: { enabled: boolean }) => {
    patients: unknown[];
    isLoading: boolean;
    error: string;
  }
>(() => ({
  patients: [],
  isLoading: false,
  error: "",
}));

vi.mock("../../components/routePlanner/useRouteOptimization", () => ({
  useRouteOptimization: () => ({
    result: routeOptimizationState.result,
    error: routeOptimizationState.error,
    isLoading: routeOptimizationState.isLoading,
    showOptimizeSuccess: routeOptimizationState.showOptimizeSuccess,
    hasAttemptedOptimize: routeOptimizationState.hasAttemptedOptimize,
    optimizeRoute: optimizeRouteMock,
  }),
}));

vi.mock("../../components/routePlanner/usePatientSearch", () => ({
  usePatientSearch: (args: { enabled: boolean }) => usePatientSearchMock(args),
}));

vi.mock("../../components/routePlanner/routePlannerService", () => ({
  persistPlanningWindows: (...args: unknown[]) => persistPlanningWindowsMock(...args),
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

describe("RoutePlanner patient selection integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    optimizeRouteMock.mockReset();
    persistPlanningWindowsMock.mockReset();
    persistPlanningWindowsMock.mockResolvedValue(undefined);
    routeOptimizationState.result = null;
    routeOptimizationState.error = "";
    routeOptimizationState.isLoading = false;
    routeOptimizationState.showOptimizeSuccess = false;
    routeOptimizationState.hasAttemptedOptimize = false;
    usePatientSearchMock.mockReset();
    usePatientSearchMock.mockImplementation(({ enabled }: { enabled: boolean }) => ({
      patients: enabled ? [janePatient, johnPatient, flexNoWindowPatient, multiWindowPatient] : [],
      isLoading: false,
      error: "",
    }));
  });

  afterEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("adds destination patients and prevents duplicate selection", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByText("1 destination(s) detected")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /Jane Doe/i })).toHaveLength(0);
  });

  it("shows a clear hint when ending point is not selected", () => {
    render(<RoutePlanner />);

    expect(
      screen.getByText("Select an ending point to enable route optimization."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Optimize Route" })).toHaveProperty(
      "disabled",
      true,
    );
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
    expect(screen.getByText("1 destination(s) detected")).toBeTruthy();

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
    });
  });

  it("promotes selected destination patient to end patient and removes from destinations", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByLabelText("Patient end address"));
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByText("End patient: Jane Doe")).toBeTruthy();
    expect(screen.getByText("0 destination(s) detected")).toBeTruthy();
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
    });
  });

  it("uses planner-edited windows as plan-only overrides unless save is checked", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

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
    });
  });

  it("includes the selected end patient in optimize destinations", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByLabelText("Patient end address"));
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "123 Main St",
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
    });
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
    });
  });

  it("shows a leave-by suggestion from the first planned stop", () => {
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
              windowType: "fixed",
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
    };

    render(<RoutePlanner />);

    expect(screen.getByText(/Suggested leave-by:/)).toBeTruthy();
    expect(
      screen.getByText(/Based on the first planned visit \(Jane Doe\)/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Patient:\s*Jane Doe\s*•\s*08:30 - 09:00\s*•\s*fixed\s*•\s*30 min/i),
    ).toBeTruthy();
    expect(screen.getByText(/Airport\s*•\s*Ending point/)).toBeTruthy();
  });

  it("removes selected destination patient from planner state", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);
    expect(screen.getByText("1 destination(s) detected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("0 destination(s) detected")).toBeTruthy();
    expect(screen.getByText("No destination patients selected yet.")).toBeTruthy();
  });

  it("requires planning window input for flexible patients without preferred windows", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Set start and end time for flexible patients without preferred windows before optimizing.",
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Flex Patient start"), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText("Flex Patient end"), {
      target: { value: "14:00" },
    });
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
          windowStart: "13:00",
          windowEnd: "14:00",
          windowType: "flexible",
          serviceDurationMinutes: 25,
        },
      ],
      canOptimize: true,
    });
  });

  it("allows excluding individual patient windows from a multi-window patient", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Mina Lee/i })[0]);

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
    });
  });

  it("can persist planner-entered windows for flexible no-window patients", async () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Flex Patient/i })[0]);

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
      });
    });
  });
});
