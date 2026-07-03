import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { setAuthSession } from "../../components/auth/authSession";

const { fetchMeMock, fetchLegalNoticeStatusMock, acknowledgeLegalNoticeMock } = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
  fetchLegalNoticeStatusMock: vi.fn(),
  acknowledgeLegalNoticeMock: vi.fn(),
}));

type PatientRecord = {
  id: string;
  nurseId: string;
  firstName: string;
  lastName: string;
  address: string;
  googlePlaceId: string | null;
  visitDurationMinutes: number;
  visitWindows: Array<{
    id: string;
    startTime: string;
    endTime: string;
    visitTimeType: "fixed" | "flexible";
  }>;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  visitTimeType: "fixed" | "flexible";
  createdAt: string;
  updatedAt: string;
};

let patientStore: PatientRecord[] = [];
let patientCounter = 1;

const listPatientsMock = vi.fn(async (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return patientStore;
  }

  return patientStore.filter((patient) => {
    return (
      patient.firstName.toLowerCase().indexOf(normalized) !== -1 ||
      patient.lastName.toLowerCase().indexOf(normalized) !== -1
    );
  });
});

const createPatientMock = vi.fn<
  (request: {
    firstName: string;
    lastName: string;
    address: string;
    googlePlaceId?: string | null;
    visitDurationMinutes: number;
    visitWindows: Array<{
      startTime: string;
      endTime: string;
      visitTimeType: "fixed" | "flexible";
    }>;
  }) => Promise<PatientRecord>
>(async (request) => {
  const createdAt = new Date().toISOString();
  const visitWindows = request.visitWindows.map((window, index) => ({
    id: `window-${patientCounter}-${index + 1}`,
    startTime: `${window.startTime}:00`,
    endTime: `${window.endTime}:00`,
    visitTimeType: window.visitTimeType,
  }));
  const primaryWindow = visitWindows[0];
  const createdPatient: PatientRecord = {
    id: `patient-${patientCounter}`,
    nurseId: "nurse-1",
    firstName: request.firstName,
    lastName: request.lastName,
    address: request.address,
    googlePlaceId: request.googlePlaceId ?? null,
    visitDurationMinutes: request.visitDurationMinutes,
    visitWindows,
    preferredVisitStartTime: primaryWindow.startTime,
    preferredVisitEndTime: primaryWindow.endTime,
    visitTimeType: primaryWindow.visitTimeType,
    createdAt,
    updatedAt: createdAt,
  };

  patientCounter += 1;
  patientStore = [...patientStore, createdPatient];
  return createdPatient;
});

const updatePatientMock = vi.fn<
  (
    patientId: string,
    request: {
      firstName?: string;
      lastName?: string;
      address?: string;
      googlePlaceId?: string | null;
      visitDurationMinutes?: number;
      visitWindows?: Array<{
        startTime: string;
        endTime: string;
        visitTimeType: "fixed" | "flexible";
      }>;
    },
  ) => Promise<PatientRecord>
>(async (patientId, request) => {
  const existingPatient = patientStore.find((patient) => patient.id === patientId);
  if (!existingPatient) {
    throw new Error("Patient not found.");
  }

  const updatedAt = new Date().toISOString();
  const nextVisitWindows = request.visitWindows
    ? request.visitWindows.map((window, index) => ({
        id: existingPatient.visitWindows[index]?.id ?? `${existingPatient.id}-window-${index + 1}`,
        startTime: `${window.startTime}:00`,
        endTime: `${window.endTime}:00`,
        visitTimeType: window.visitTimeType,
      }))
    : existingPatient.visitWindows;
  const primaryWindow = nextVisitWindows[0];

  const updatedPatient: PatientRecord = {
    ...existingPatient,
    ...request,
    visitWindows: nextVisitWindows,
    preferredVisitStartTime: primaryWindow.startTime,
    preferredVisitEndTime: primaryWindow.endTime,
    visitTimeType: primaryWindow.visitTimeType,
    updatedAt,
  };

  patientStore = patientStore.map((patient) =>
    patient.id === patientId ? updatedPatient : patient,
  );

  return updatedPatient;
});

const deletePatientMock = vi.fn(async (patientId: string) => {
  patientStore = patientStore.filter((patient) => patient.id !== patientId);
  return { deleted: true as const, id: patientId };
});

const requestOptimizedRouteMock = vi.fn(
  async (request: {
    startAddress: string;
    endAddress: string;
    destinations: Array<{
      address: string;
      patientId: string;
      patientName: string;
      googlePlaceId?: string | null;
      windowStart: string;
      windowEnd: string;
      windowType: "fixed" | "flexible";
      serviceDurationMinutes?: number;
    }>;
  }) => {
    const visitStops = request.destinations.map((destination, index) => ({
      stopId: `stop-${index + 1}`,
      address: destination.address,
      coords: { lat: 43.0 + index, lon: -79.0 - index },
      arrivalTime: `2026-03-13T0${8 + index}:00:00.000Z`,
      departureTime: `2026-03-13T0${8 + index}:20:00.000Z`,
      tasks: [
        {
          visitId: `visit-${index + 1}-${destination.patientId}`,
          patientId: destination.patientId,
          patientName: destination.patientName,
          address: destination.address,
          ...(destination.googlePlaceId !== undefined
            ? { googlePlaceId: destination.googlePlaceId }
            : {}),
          windowStart: destination.windowStart,
          windowEnd: destination.windowEnd,
          windowType: destination.windowType,
          serviceDurationMinutes: destination.serviceDurationMinutes ?? 20,
          arrivalTime: `2026-03-13T0${8 + index}:00:00.000Z`,
          serviceStartTime: `2026-03-13T0${8 + index}:00:00.000Z`,
          serviceEndTime: `2026-03-13T0${8 + index}:20:00.000Z`,
          waitSeconds: 0,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
      distanceFromPreviousKm: index + 1,
      durationFromPreviousSeconds: 120,
    }));

    const orderedStops = [
      ...visitStops,
      {
        stopId: `stop-${visitStops.length + 1}`,
        address: request.endAddress,
        coords: { lat: 43.2, lon: -79.2 },
        arrivalTime: "2026-03-13T12:00:00.000Z",
        departureTime: "2026-03-13T12:00:00.000Z",
        tasks: [],
        distanceFromPreviousKm: 1,
        durationFromPreviousSeconds: 120,
        isEndingPoint: true,
      },
    ];

    return {
      start: {
        address: request.startAddress,
        coords: { lat: 43.1, lon: -79.1 },
        departureTime: "2026-03-13T07:30:00.000Z",
      },
      end: {
        address: request.endAddress,
        coords: { lat: 43.2, lon: -79.2 },
      },
      orderedStops,
      routeLegs: [],
      unscheduledTasks: [],
      metrics: {
        fixedWindowViolations: 0,
        totalLateSeconds: 0,
        totalWaitSeconds: 0,
        totalDistanceMeters: 1000,
        totalDistanceKm: 1,
        totalDurationSeconds: 120,
      },
      algorithmVersion: "v2.1.0-greedy-window-first",
    };
  },
);

vi.mock("../../features/patients/api/patientService", () => ({
  listPatients: (query: string) => listPatientsMock(query),
  createPatient: (request: Parameters<typeof createPatientMock>[0]) => createPatientMock(request),
  updatePatient: (patientId: string, request: Parameters<typeof updatePatientMock>[1]) =>
    updatePatientMock(patientId, request),
  deletePatient: (patientId: string) => deletePatientMock(patientId),
  archiveClients: () => Promise.resolve([]),
  restoreClient: () => Promise.resolve({}),
  fetchPatientCounts: () => Promise.resolve({ active: 0, idle: 0, archived: 0 }),
}));

vi.mock("../../features/patients/api/recurringVisitTemplateService", () => ({
  listRecurringVisitTemplates: vi.fn(async () => []),
  createRecurringVisitTemplate: vi.fn(),
  updateRecurringVisitTemplate: vi.fn(),
  deleteRecurringVisitTemplate: vi.fn(),
}));

vi.mock("../../features/route-planner/api/routePlannerService", () => ({
  requestOptimizedRoute: (request: Parameters<typeof requestOptimizedRouteMock>[0]) =>
    requestOptimizedRouteMock(request),
  persistPlanningWindows: vi.fn(async () => undefined),
  requestExpandVisitInstances: vi.fn(async () => undefined),
  requestRecurringVisitTemplates: vi.fn(async () => []),
  requestVisitInstances: vi.fn(async () => []),
  resolveWorkingHoursForDate: () => null,
}));

vi.mock("../../components/auth/authService", () => ({
  fetchMe: fetchMeMock,
  updateProfile: vi.fn(),
  updateProfileHomeAddress: vi.fn(),
  login: vi.fn(),
  signUp: vi.fn(),
  fetchLegalNoticeStatus: fetchLegalNoticeStatusMock,
  acknowledgeLegalNotice: acknowledgeLegalNoticeMock,
}));

// The header's notifications bell fetches the dashboard summary on mount — stub
// it so it doesn't make a real network call during the integration flow.
vi.mock("../../components/home/homeDashboardService", async () => {
  const actual = await vi.importActual<typeof import("../../components/home/homeDashboardService")>(
    "../../components/home/homeDashboardService",
  );
  return {
    ...actual,
    fetchDashboardSummary: vi.fn(async () => ({
      asOf: "2026-07-02T00:00:00.000Z",
      timezone: "UTC",
      kpis: {
        routesToday: 0,
        visitsScheduledToday: 0,
        visitsScheduledLast7Days: 0,
        onTimeRatePercent7d: null,
        staleClientsCount: 0,
        driveHoursLast7Days: 0,
        totalDistanceKm7d: 0,
        activePatientCount: 0,
        templatedActivePatientCount: 0,
      },
      alerts: [],
      upcomingStops: [],
      trend: [],
      busiestDays: [],
      patientRisks: [],
      snapshot: {
        completedRoutes: 0,
        delayedRoutes: 0,
        unscheduledVisits: 0,
        totalDistanceKm: 0,
      },
    })),
  };
});

vi.mock("../../components/shared/AddressAutocompleteInput", () => ({
  default: ({
    id,
    label,
    value,
    onChange,
    disabled,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        disabled={Boolean(disabled)}
        onChange={(event) => onChange((event.target as HTMLInputElement).value)}
      />
    </div>
  ),
}));

vi.mock("../../features/route-planner/RouteMap", () => ({
  default: () => null,
}));

import App from "../../App";

describe("patients and route planner integration", () => {
  beforeEach(() => {
    fetchMeMock.mockReset();
    fetchMeMock.mockResolvedValue({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: null,
        isSetupComplete: true,
        setupMissing: [],
      },
    });
    fetchLegalNoticeStatusMock.mockReset();
    fetchLegalNoticeStatusMock.mockResolvedValue({
      required: false,
      currentVersion: "2026-04-16",
      acceptedVersion: "2026-04-16",
      acceptedAt: "2026-04-16T10:00:00.000Z",
    });
    acknowledgeLegalNoticeMock.mockReset();
    acknowledgeLegalNoticeMock.mockResolvedValue({
      required: false,
      currentVersion: "2026-04-16",
      acceptedVersion: "2026-04-16",
      acceptedAt: "2026-04-16T10:00:00.000Z",
    });
    window.localStorage.clear();
    setAuthSession({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      homeAddress: null,
      isSetupComplete: true,
      setupMissing: [],
    });

    patientStore = [];
    patientCounter = 1;

    listPatientsMock.mockClear();
    createPatientMock.mockClear();
    updatePatientMock.mockClear();
    deletePatientMock.mockClear();
    requestOptimizedRouteMock.mockClear();

    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    cleanup();
  });

  it("supports create -> search -> edit -> delete lifecycle on /clients", async () => {
    render(
      <MemoryRouter initialEntries={["/clients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByPlaceholderText("Search clients by name or address")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "123 Main St" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "doe" },
    });

    await waitFor(() => {
      expect(listPatientsMock).toHaveBeenLastCalledWith("doe");
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Jane Doe" }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Janet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Janet Doe").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive Janet Doe" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(deletePatientMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("No clients match this search.")).toBeTruthy();
    });
  });

  it("makes created patients available on /route-planner and preserves patient context in optimization", async () => {
    render(
      <MemoryRouter initialEntries={["/clients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByPlaceholderText("Search clients by name or address")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Smith" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "456 Queen St" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

    await waitFor(() => {
      expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    });

    // Nav renders twice (desktop header + mobile strip); either link routes the same.
    fireEvent.click(screen.getAllByRole("link", { name: "Route Planner" })[0]);
    expect(await screen.findByRole("heading", { name: "Smart Route Planner" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.change(screen.getByLabelText("Destination client search"), {
      target: { value: "john" },
    });

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /John Smith/i })).toBeTruthy();
      },
      { timeout: 1500 },
    );

    fireEvent.click(screen.getByRole("button", { name: /John Smith/i }));
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    await waitFor(() => {
      expect(requestOptimizedRouteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endAddress: "Airport",
          destinations: [
            expect.objectContaining({
              patientName: "John Smith",
              address: "456 Queen St",
            }),
          ],
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Toggle details for John Smith/i,
        }),
      ).toBeTruthy();
    });
  });
});
