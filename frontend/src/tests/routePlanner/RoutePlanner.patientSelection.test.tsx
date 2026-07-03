import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routeOptimizationState, locationState } = vi.hoisted(() => ({
  routeOptimizationState: {
    result: null as unknown,
    error: "",
    isLoading: false,
    showOptimizeSuccess: false,
    showOptimizeFlash: false,
    hasAttemptedOptimize: false,
  },
  locationState: {
    state: null as unknown,
    pathname: "/route-planner",
    search: "",
    hash: "",
  },
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => locationState,
}));

const optimizeRouteMock = vi.fn();
const persistPlanningWindowsMock = vi.fn();
const requestExpandVisitInstancesMock = vi.fn();
const requestRecurringVisitTemplatesMock = vi.fn();
const requestVisitInstancesMock = vi.fn();
const requestUpdateVisitInstanceMock = vi.fn();
const createPatientMock = vi.fn();
const usePatientSearchMock = vi.fn<
  (args: { query?: string; enabled: boolean }) => {
    patients: unknown[];
    isLoading: boolean;
    error: string;
  }
>(() => ({
  patients: [],
  isLoading: false,
  error: "",
}));

vi.mock("../../features/route-planner/hooks/useRouteOptimization", () => ({
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

vi.mock("../../features/route-planner/hooks/usePatientSearch", () => ({
  usePatientSearch: (args: { query?: string; enabled: boolean }) => usePatientSearchMock(args),
}));

vi.mock("../../features/route-planner/api/routePlannerService", () => ({
  persistPlanningWindows: (...args: unknown[]) => persistPlanningWindowsMock(...args),
  requestExpandVisitInstances: (...args: unknown[]) => requestExpandVisitInstancesMock(...args),
  requestRecurringVisitTemplates: (...args: unknown[]) =>
    requestRecurringVisitTemplatesMock(...args),
  requestVisitInstances: (...args: unknown[]) => requestVisitInstancesMock(...args),
  requestUpdateVisitInstance: (...args: unknown[]) => requestUpdateVisitInstanceMock(...args),
  resolveWorkingHoursForDate: () => null,
}));

vi.mock("../../features/patients/api/patientService", () => ({
  createPatient: (...args: unknown[]) => createPatientMock(...args),
}));

vi.mock("../../components/shared/AddressAutocompleteInput", () => ({
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

vi.mock("../../features/route-planner/RouteMap", () => ({
  default: () => null,
}));

import RoutePlanner from "../../features/route-planner/ui/RoutePlanner";

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

const getDefaultPlanningDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// The start address is no longer prepopulated for new users (empty by default),
// so tests that optimize a route must enter a starting point first — mirroring
// what a real nurse without a saved home address does.
const setStartingPoint = (value = "3361 Ingram Road, Mississauga, ON") =>
  fireEvent.change(screen.getByLabelText(/Starting point/i), { target: { value } });

describe("RoutePlanner patient selection integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    optimizeRouteMock.mockReset();
    persistPlanningWindowsMock.mockReset();
    requestExpandVisitInstancesMock.mockReset();
    requestRecurringVisitTemplatesMock.mockReset();
    requestVisitInstancesMock.mockReset();
    requestUpdateVisitInstanceMock.mockReset();
    createPatientMock.mockReset();
    persistPlanningWindowsMock.mockResolvedValue(undefined);
    requestExpandVisitInstancesMock.mockResolvedValue(undefined);
    requestRecurringVisitTemplatesMock.mockResolvedValue([]);
    requestVisitInstancesMock.mockResolvedValue([]);
    requestUpdateVisitInstanceMock.mockResolvedValue(undefined);
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
    locationState.state = null;
    usePatientSearchMock.mockReset();
    usePatientSearchMock.mockImplementation(
      ({ enabled }: { query?: string; enabled: boolean }) => ({
        patients: enabled
          ? [janePatient, johnPatient, flexNoWindowPatient, multiWindowPatient]
          : [],
        isLoading: false,
        error: "",
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    cleanup();
  });

  it("locks the client selection and trip setup areas while an optimize is in flight", () => {
    // Guards the Option A fix: mid-optimize edits would land in the inputs but be
    // absent from the in-flight result, so trip setup and the whole selection
    // area are disabled while optimizing.
    const lockIds = ["client-selection-fieldset", "trip-setup-fieldset"];

    routeOptimizationState.isLoading = true;
    const { container, unmount } = render(<RoutePlanner />);
    lockIds.forEach((id) => {
      expect(
        (container.querySelector(`[data-testid="${id}"]`) as HTMLFieldSetElement)?.disabled,
      ).toBe(true);
    });
    unmount();

    routeOptimizationState.isLoading = false;
    const { container: notOptimizing } = render(<RoutePlanner />);
    lockIds.forEach((id) => {
      expect(
        (notOptimizing.querySelector(`[data-testid="${id}"]`) as HTMLFieldSetElement)?.disabled,
      ).toBe(false);
    });
  });

  it("prefills start and end addresses from nurse home address", () => {
    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText(/Starting point/i)).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
    expect(screen.getByLabelText(/Ending point/i)).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
  });

  it("ignores stored draft trip values and uses nurse home address defaults", () => {
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

    expect(screen.getByLabelText(/Starting point/i)).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
    expect(screen.getByLabelText(/Ending point/i)).toHaveProperty(
      "value",
      "1 Home Way, Mississauga, ON",
    );
  });

  it("adds destination patients and prevents duplicate selection", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByRole("button", { name: "Edit window" })).toBeTruthy();
    expect(screen.queryByText("Include this visit in route")).toBeNull();
    // Jane Doe button in the search results list should be gone (duplicate prevention);
    // only the destination row name button (title="Jane Doe") should remain
    expect(screen.getAllByRole("button", { name: /^Jane Doe(?: · .+)?$/i })).toHaveLength(1);
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

    fireEvent.click(screen.getByRole("button", { name: "Collapse client search" }));

    const moreButton = screen.getByRole("button", { name: "+1 more" });
    expect(moreButton).toBeTruthy();

    fireEvent.click(moreButton);

    expect(screen.getByLabelText("Destination client search")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+1 more" })).toBeNull();
  });

  it("requires reselecting clients after remounting route planner and does not restore trip addresses", async () => {
    const { unmount } = render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    await waitFor(() => {
      const storedDraft = window.localStorage.getItem("careflow.route-planner.draft.v1");
      expect(storedDraft).toBeTruthy();
      const parsedDraft = JSON.parse(storedDraft as string) as {
        selectedDestinationStates?: Array<{ patientId: string }>;
      };
      expect(
        parsedDraft.selectedDestinationStates?.some((state) => state.patientId === "patient-1"),
      ).toBe(true);
    });

    unmount();
    render(<RoutePlanner />);

    // Neither trip address is restored/prepopulated after a remount.
    expect(screen.getByLabelText(/Starting point/i)).toHaveProperty("value", "");
    expect(screen.getByLabelText(/Ending point/i)).toHaveProperty("value", "");

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).not.toHaveBeenCalled();

    setStartingPoint();
    fireEvent.click(screen.getByRole("button", { name: "Expand client search" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
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
      optimizationObjective: "time",
    });
  });

  it("allows route optimization when selected patient windows overlap", () => {
    render(<RoutePlanner />);

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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
      optimizationObjective: "time",
    });
  });

  it("hydrates selected destinations from visit instances for planning date", async () => {
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-1",
        occurrenceKey: "patient-1:2026-03-14:0",
        planningDate: "2026-03-14",
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "08:00",
        windowEnd: "08:30",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);

    render(<RoutePlanner />);

    await waitFor(() => {
      expect(requestVisitInstancesMock).toHaveBeenCalledTimes(1);
    });

    setStartingPoint();
    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            visitId: "instance-1",
            windowStart: "08:00",
            windowEnd: "08:30",
          }),
        ],
      }),
    );
  });

  it("excludes orphaned visit instances from auto-seeded destinations", async () => {
    requestRecurringVisitTemplatesMock.mockResolvedValue([
      {
        id: "template-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Monday",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        startDate: "2026-03-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [1],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-1",
        occurrenceKey: "patient-1:2026-03-14:0",
        planningDate: "2026-03-14",
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "08:00",
        windowEnd: "08:30",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
      {
        id: "instance-null-orphan",
        nurseId: "nurse-1",
        patientId: "patient-2",
        templateId: null,
        occurrenceKey: "patient-2:2026-03-14:null",
        planningDate: "2026-03-14",
        address: "456 Queen St",
        googlePlaceId: null,
        windowStart: "09:30",
        windowEnd: "10:30",
        visitTimeType: "flexible",
        serviceDurationMinutes: 45,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
      {
        id: "instance-orphan",
        nurseId: "nurse-1",
        patientId: "patient-2",
        templateId: "template-missing",
        occurrenceKey: "patient-2:2026-03-14:0",
        planningDate: "2026-03-14",
        address: "456 Queen St",
        googlePlaceId: null,
        windowStart: "10:00",
        windowEnd: "12:00",
        visitTimeType: "flexible",
        serviceDurationMinutes: 45,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);

    render(<RoutePlanner />);

    await waitFor(() => {
      expect(requestVisitInstancesMock).toHaveBeenCalledTimes(1);
      expect(requestRecurringVisitTemplatesMock).toHaveBeenCalledTimes(1);
    });

    setStartingPoint();
    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            patientId: "patient-1",
            visitId: "instance-1",
          }),
        ],
      }),
    );
    const latestOptimizeCall =
      optimizeRouteMock.mock.calls[optimizeRouteMock.mock.calls.length - 1];
    expect(latestOptimizeCall?.[0]?.destinations).toHaveLength(1);
  });

  it("skips an auto-seeded occurrence from the selected clients list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z")); // Sunday → tomorrow is Monday
    const planningDate = getDefaultPlanningDate();
    requestRecurringVisitTemplatesMock.mockResolvedValueOnce([
      {
        id: "template-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Monday",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        startDate: "2026-03-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [1],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-1",
        occurrenceKey: `patient-1:${planningDate}:0`,
        planningDate,
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "08:00",
        windowEnd: "08:30",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestUpdateVisitInstanceMock.mockResolvedValue({
      id: "instance-1",
      nurseId: "nurse-1",
      patientId: "patient-1",
      templateId: "template-1",
      occurrenceKey: `patient-1:${planningDate}:0`,
      planningDate,
      address: "123 Main St",
      googlePlaceId: "place-1",
      windowStart: "08:00",
      windowEnd: "08:30",
      visitTimeType: "fixed",
      serviceDurationMinutes: 30,
      status: "cancelled",
      isManualOverride: true,
      createdAt: "2026-03-12T12:00:00.000Z",
      updatedAt: "2026-03-12T12:05:00.000Z",
    });

    render(<RoutePlanner />);

    await act(async () => {});
    expect(requestVisitInstancesMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip occurrence" }));

    await act(async () => {});
    expect(requestUpdateVisitInstanceMock).toHaveBeenCalledWith("instance-1", {
      status: "cancelled",
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    expect(screen.getByRole("button", { name: "Restore occurrence" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("restores a skipped auto-seeded occurrence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z")); // Sunday → tomorrow is Monday
    const planningDate = getDefaultPlanningDate();
    requestRecurringVisitTemplatesMock.mockResolvedValueOnce([
      {
        id: "template-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Monday",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        startDate: "2026-03-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [1],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-1",
        occurrenceKey: `patient-1:${planningDate}:0`,
        planningDate,
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "08:00",
        windowEnd: "08:30",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "cancelled",
        isManualOverride: true,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:05:00.000Z",
      },
    ]);
    requestUpdateVisitInstanceMock.mockResolvedValue({
      id: "instance-1",
      nurseId: "nurse-1",
      patientId: "patient-1",
      templateId: "template-1",
      occurrenceKey: `patient-1:${planningDate}:0`,
      planningDate,
      address: "123 Main St",
      googlePlaceId: "place-1",
      windowStart: "08:00",
      windowEnd: "08:30",
      visitTimeType: "fixed",
      serviceDurationMinutes: 30,
      status: "scheduled",
      isManualOverride: true,
      createdAt: "2026-03-12T12:00:00.000Z",
      updatedAt: "2026-03-12T12:06:00.000Z",
    });

    render(<RoutePlanner />);

    await act(async () => {});
    expect(requestVisitInstancesMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore occurrence" }));

    await act(async () => {});
    expect(requestUpdateVisitInstanceMock).toHaveBeenCalledWith("instance-1", {
      status: "scheduled",
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    expect(screen.getByRole("button", { name: "Skip occurrence" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("reschedules an occurrence off the current planning date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z")); // Sunday → tomorrow is Monday
    const planningDate = getDefaultPlanningDate();
    const rescheduledDate = (() => {
      const nextDate = new Date(`${planningDate}T12:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate.toISOString().slice(0, 10);
    })();
    requestRecurringVisitTemplatesMock.mockResolvedValueOnce([
      {
        id: "template-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Monday",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        startDate: "2026-03-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [1],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-1",
        occurrenceKey: `patient-1:${planningDate}:0`,
        planningDate,
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "08:00",
        windowEnd: "08:30",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestUpdateVisitInstanceMock.mockResolvedValue({
      id: "instance-1",
      nurseId: "nurse-1",
      patientId: "patient-1",
      templateId: "template-1",
      occurrenceKey: `patient-1:${planningDate}:0`,
      planningDate: rescheduledDate,
      address: "123 Main St",
      googlePlaceId: "place-1",
      windowStart: "08:00",
      windowEnd: "08:30",
      visitTimeType: "fixed",
      serviceDurationMinutes: 30,
      status: "scheduled",
      isManualOverride: true,
      createdAt: "2026-03-12T12:00:00.000Z",
      updatedAt: "2026-03-12T12:06:00.000Z",
    });

    render(<RoutePlanner />);

    await act(async () => {});
    expect(requestVisitInstancesMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit window" }));
    fireEvent.change(screen.getByLabelText("Jane Doe date"), {
      target: { value: rescheduledDate },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save occurrence changes" }));

    await act(async () => {});
    expect(requestUpdateVisitInstanceMock).toHaveBeenCalledWith("instance-1", {
      planningDate: rescheduledDate,
    });

    expect(screen.getByText("No clients selected yet")).toBeTruthy();
    vi.useRealTimers();
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

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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
      optimizationObjective: "time",
    });
  });

  it("uses planner-edited windows as plan-only overrides unless save is checked", () => {
    render(<RoutePlanner />);

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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
      optimizationObjective: "time",
    });
  });

  it("hides home-address warning banner when home address exists", () => {
    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    expect(screen.queryByText("Home address not set")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open account settings" })).toBeNull();
  });

  it("creates a new patient from destination card and auto-selects it", async () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Add Client" }));
    expect(screen.getByRole("heading", { name: "Add Client" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Olivia" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Brown" },
    });
    fireEvent.change(screen.getByLabelText(/Address/i), {
      target: { value: "88 Queen Street, Toronto, ON" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new client" }));

    await waitFor(() => {
      expect(createPatientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Olivia",
          lastName: "Brown",
          address: "88 Queen Street, Toronto, ON",
        }),
      );
    });

    expect(
      await screen.findByRole("button", {
        name: /(?:^New Patient(?: · .+)?$|^Toggle windows for New Patient$)/i,
      }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Add Client" })).toBeNull();
    });
  });

  it("requires at least one selected client before optimizing", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });

    const optimizeButton = screen.getByRole("button", { name: "Optimize Route" });
    expect(optimizeButton).toHaveProperty("disabled", true);

    fireEvent.click(optimizeButton);
    expect(optimizeRouteMock).not.toHaveBeenCalled();
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
    expect(screen.getByText(/Outside fixed window by 20 min/i)).toBeTruthy();
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
    expect(screen.queryByText(/Outside (fixed|preferred) window by/i)).toBeNull();
  });

  it("removes selected destination patient from planner state", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);

    fireEvent.click(screen.getByRole("button", { name: /Remove John Smith/i }));

    expect(screen.getByText("No clients selected yet")).toBeTruthy();
  });

  it("auto-optimizes when autoOptimizeToday is set, instances are loaded, and home address is present", async () => {
    // Compute today's date the same way todayPlanningDate() does in the component
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    locationState.state = { autoOptimizeToday: true };

    // Use a daily template so it matches regardless of which day the test runs
    requestRecurringVisitTemplatesMock.mockResolvedValueOnce([
      {
        id: "template-daily",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Daily",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=DAILY",
        startDate: "2026-01-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-today-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-daily",
        occurrenceKey: `patient-1:${todayStr}:0`,
        planningDate: todayStr,
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "09:00",
        windowEnd: "11:00",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);

    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    // waitFor polls without fake timers, so it correctly waits for cascading
    // async state updates (load instances → seed destinations → auto-optimize effect)
    await waitFor(() => {
      expect(optimizeRouteMock).toHaveBeenCalledTimes(1);
    });

    expect(optimizeRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planningDate: todayStr,
        destinations: [
          expect.objectContaining({
            patientId: "patient-1",
            visitId: "instance-today-1",
            windowStart: "09:00",
            windowEnd: "11:00",
          }),
        ],
      }),
    );
  });

  it("uses today as planning date when autoOptimizeToday is set", () => {
    // Compute today and tomorrow the same way the component helpers do
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    locationState.state = { autoOptimizeToday: true };

    render(<RoutePlanner />);

    // DatePicker is a button whose text content shows the formatted selected date.
    // With autoOptimizeToday it should show today, not tomorrow (the normal default).
    const dateButton = screen.getByRole("button", { name: "Planning date" });
    const todayFormatted = new Date(todayStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const tomorrowFormatted = new Date(tomorrowStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    expect(dateButton.textContent).toContain(todayFormatted);
    expect(dateButton.textContent).not.toContain(tomorrowFormatted);
  });

  it("does not auto-optimize when autoOptimizeToday flag is absent", async () => {
    // locationState.state is null (default) — no autoOptimizeToday

    // Use a daily template so it would match if (incorrectly) auto-optimize ran
    requestRecurringVisitTemplatesMock.mockResolvedValueOnce([
      {
        id: "template-daily",
        nurseId: "nurse-1",
        patientId: "patient-1",
        name: "Daily",
        timezone: "America/Toronto",
        recurrenceRule: "FREQ=DAILY",
        startDate: "2026-01-01",
        endDate: null,
        isActive: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    requestVisitInstancesMock.mockResolvedValueOnce([
      {
        id: "instance-tomorrow-1",
        nurseId: "nurse-1",
        patientId: "patient-1",
        templateId: "template-daily",
        occurrenceKey: `patient-1:${tomorrowStr}:0`,
        planningDate: tomorrowStr,
        address: "123 Main St",
        googlePlaceId: "place-1",
        windowStart: "09:00",
        windowEnd: "11:00",
        visitTimeType: "fixed",
        serviceDurationMinutes: 30,
        status: "scheduled",
        isManualOverride: false,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);

    render(<RoutePlanner nurseHomeAddress="1 Home Way, Mississauga, ON" />);

    await act(async () => {});

    expect(optimizeRouteMock).not.toHaveBeenCalled();
  });

  it("allows optimizing flexible patients without preferred windows", () => {
    render(<RoutePlanner />);

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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
      optimizationObjective: "time",
    });
  });

  it("requires both window boundaries when nurse partially sets a flexible window", () => {
    render(<RoutePlanner />);

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Mina Lee/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Toggle windows for Mina Lee" }));
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
      optimizationObjective: "time",
    });
  });

  it("can persist planner-entered windows for flexible no-window patients", async () => {
    render(<RoutePlanner />);

    setStartingPoint();

    fireEvent.change(screen.getByLabelText(/Ending point/i), {
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
    fireEvent.click(screen.getByRole("checkbox", { name: "Save this window to client record" }));

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
        optimizationObjective: "time",
      });
    });
  });

  it("restores Your Route from a cached/saved result when only templates would auto-seed", async () => {
    // A result is present on mount (restored from the session/runtime cache or a
    // saved run) but nothing auto-seeds those clients. The reconcile effect
    // should rebuild Your Route from the result's visits so it matches.
    routeOptimizationState.result = {
      timezone: "America/Toronto",
      start: {
        address: "Home",
        coords: { lat: 43.6, lon: -79.5 },
        departureTime: "2026-07-02T12:00:00.000Z",
      },
      end: { address: "Home", coords: { lat: 43.6, lon: -79.5 } },
      orderedStops: [
        {
          stopId: "s1",
          address: "123 Main St",
          coords: { lat: 43.7, lon: -79.7 },
          arrivalTime: "2026-07-02T12:00:00.000Z",
          departureTime: "2026-07-02T12:30:00.000Z",
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 60,
          isEndingPoint: false,
          tasks: [
            {
              visitId: "v-1",
              patientId: "patient-1",
              patientName: "Jane Doe",
              address: "123 Main St",
              windowStart: "09:00",
              windowEnd: "11:00",
              windowType: "fixed",
              serviceDurationMinutes: 30,
              arrivalTime: "2026-07-02T12:40:00.000Z",
              serviceStartTime: "2026-07-02T12:40:00.000Z",
              serviceEndTime: "2026-07-02T12:55:00.000Z",
              waitSeconds: 0,
              lateBySeconds: 0,
              onTime: true,
            },
          ],
        },
        {
          stopId: "s2",
          address: "456 Oak Ave",
          coords: { lat: 43.71, lon: -79.71 },
          arrivalTime: "2026-07-02T12:00:00.000Z",
          departureTime: "2026-07-02T12:30:00.000Z",
          distanceFromPreviousKm: 2,
          durationFromPreviousSeconds: 120,
          isEndingPoint: false,
          tasks: [
            {
              visitId: "v-2",
              patientId: "patient-2",
              patientName: "John Smith",
              address: "456 Oak Ave",
              windowStart: "12:00",
              windowEnd: "13:00",
              windowType: "flexible",
              serviceDurationMinutes: 20,
              arrivalTime: "2026-07-02T12:40:00.000Z",
              serviceStartTime: "2026-07-02T12:40:00.000Z",
              serviceEndTime: "2026-07-02T12:55:00.000Z",
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
          arrivalTime: "2026-07-02T12:00:00.000Z",
          departureTime: "2026-07-02T12:30:00.000Z",
          distanceFromPreviousKm: 1,
          durationFromPreviousSeconds: 60,
          isEndingPoint: true,
          tasks: [],
        },
      ],
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
      },
      algorithmVersion: "v3",
    };
    routeOptimizationState.hasAttemptedOptimize = true;

    render(<RoutePlanner />);

    // The client section collapses when a result is present — expand it to see
    // Your Route. It should be reconciled from the result's visits (both
    // clients), not just the auto-seeded templates (none here).
    fireEvent.click(await screen.findByRole("button", { name: "Expand client search" }));

    expect(await screen.findByRole("button", { name: /Remove Jane Doe/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Remove John Smith/i })).toBeTruthy();
  });
});
