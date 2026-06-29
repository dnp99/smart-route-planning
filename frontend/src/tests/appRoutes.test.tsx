import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { clearAuthSession, setAuthSession } from "../components/auth/authSession";

const {
  fetchMeMock,
  updateProfileMock,
  listPatientsMock,
  fetchDashboardSummaryMock,
  fetchLegalNoticeStatusMock,
  acknowledgeLegalNoticeMock,
} = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
  updateProfileMock: vi.fn(),
  listPatientsMock: vi.fn(),
  fetchDashboardSummaryMock: vi.fn(),
  fetchLegalNoticeStatusMock: vi.fn(),
  acknowledgeLegalNoticeMock: vi.fn(),
}));

vi.mock("../components/auth/authService", () => ({
  fetchMe: fetchMeMock,
  updateProfile: updateProfileMock,
  updateProfileHomeAddress: vi.fn(),
  login: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
  fetchLegalNoticeStatus: fetchLegalNoticeStatusMock,
  acknowledgeLegalNotice: acknowledgeLegalNoticeMock,
}));

vi.mock("../features/patients/api/patientService", () => ({
  listPatients: listPatientsMock,
  fetchStaleClients: vi.fn().mockResolvedValue({ snoozedUntil: null, patients: [] }),
  archiveClients: vi.fn().mockResolvedValue([]),
  dismissStaleReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/patients/api/recurringVisitTemplateService", () => ({
  listRecurringVisitTemplates: vi.fn(async () => []),
  createRecurringVisitTemplate: vi.fn(),
  updateRecurringVisitTemplate: vi.fn(),
  deleteRecurringVisitTemplate: vi.fn(),
}));

vi.mock("../components/home/homeDashboardService", () => ({
  fetchDashboardSummary: fetchDashboardSummaryMock,
}));

vi.mock("../components/shared/AddressAutocompleteInput", () => ({
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

beforeEach(() => {
  window.localStorage.clear();
  clearAuthSession();
  vi.stubGlobal("open", vi.fn());
  fetchMeMock.mockReset();
  fetchLegalNoticeStatusMock.mockReset();
  acknowledgeLegalNoticeMock.mockReset();
  updateProfileMock.mockReset();
  listPatientsMock.mockResolvedValue([]);
  fetchDashboardSummaryMock.mockReset();
  fetchDashboardSummaryMock.mockResolvedValue({
    asOf: "2026-04-16T12:00:00.000Z",
    timezone: "America/Toronto",
    kpis: {
      routesToday: 3,
      visitsScheduledToday: 11,
      visitsScheduledLast7Days: 45,
      activePatientCount: 24,
      templatedActivePatientCount: 8,
      deletedClientsLast30Days: 2,
      driveHoursLast7Days: 7.4,
      totalDistanceKm7d: 120.5,
      onTimeRatePercent7d: 92,
      unscheduledVisitsToday: 1,
      driveHoursToday: 7.4,
    },
    alerts: [],
    upcomingStops: [],
    trend: [
      { date: "2026-04-10", label: "Fri", onTimeRatePercent: 88 },
      { date: "2026-04-11", label: "Sat", onTimeRatePercent: 84 },
      { date: "2026-04-12", label: "Sun", onTimeRatePercent: 90 },
      { date: "2026-04-13", label: "Mon", onTimeRatePercent: 94 },
      { date: "2026-04-14", label: "Tue", onTimeRatePercent: 91 },
      { date: "2026-04-15", label: "Wed", onTimeRatePercent: 93 },
      { date: "2026-04-16", label: "Thu", onTimeRatePercent: 92 },
    ],
    snapshot: {
      completedRoutes: 3,
      delayedRoutes: 1,
      unscheduledVisits: 1,
      totalDistanceKm: 42.3,
    },
  });
  fetchMeMock.mockResolvedValue({
    user: {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      homeAddress: null,
    },
  });
  fetchLegalNoticeStatusMock.mockResolvedValue({
    required: false,
    currentVersion: "2026-04-16",
    acceptedVersion: "2026-04-16",
    acceptedAt: "2026-04-16T10:00:00.000Z",
  });
  updateProfileMock.mockResolvedValue({
    user: {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      homeAddress: "1 Main Street, Toronto, ON",
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  cleanup();
});

const seedAuthenticatedSession = (displayName = "Nurse One", homeAddress: string | null = null) => {
  setAuthSession({
    id: "nurse-1",
    email: "nurse@example.com",
    displayName,
    homeAddress,
  });
};

const waitForPatientsPage = async () => {
  await screen.findByRole("heading", { name: /^Clients \d+( of \d+)?$/ });
};

describe("Footer", () => {
  it("renders footer with Contact Us and all legal links", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    await waitForPatientsPage();

    expect(screen.getByRole("button", { name: "Contact Us" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "License" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trademark" })).toBeTruthy();
  });

  it("footer Contact Us opens a support email form", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    await waitForPatientsPage();

    fireEvent.click(screen.getByRole("button", { name: "Contact Us" }));

    expect(screen.getByRole("dialog", { name: "Contact Us" })).toBeTruthy();
    expect(screen.getByLabelText("Subject")).toBeTruthy();
    expect(screen.getByLabelText("Message")).toBeTruthy();
  });

  it("footer Contact Us validates and prepares a support email fallback", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    await waitForPatientsPage();

    fireEvent.click(screen.getByRole("button", { name: "Contact Us" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare message" }));

    expect(screen.getByText("Subject and message are required.")).toBeTruthy();
    expect(window.open).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Billing question" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Can you help with my account?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare message" }));

    expect(screen.getByText(/Your message is ready/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open email app" }).getAttribute("href")).toBe(
      "mailto:dpatel1995@yahoo.com?subject=Billing+question&body=Can+you+help+with+my+account%3F",
    );
    expect(screen.getByRole("button", { name: "Copy message" })).toBeTruthy();
  });

  it("footer legal links point to correct routes", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    await waitForPatientsPage();

    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "/legal/privacy",
    );
    expect(screen.getByRole("link", { name: "License" }).getAttribute("href")).toBe(
      "/legal/license",
    );
    expect(screen.getByRole("link", { name: "Trademark" }).getAttribute("href")).toBe(
      "/legal/trademark",
    );
  });
});

describe("Legal pages", () => {
  it("renders Terms page at /legal/terms", async () => {
    render(
      <MemoryRouter initialEntries={["/legal/terms"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Terms of Service" })).toBeTruthy();
  });

  it("renders Privacy page at /legal/privacy", async () => {
    render(
      <MemoryRouter initialEntries={["/legal/privacy"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
  });

  it("renders License page at /legal/license", async () => {
    render(
      <MemoryRouter initialEntries={["/legal/license"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "License" })).toBeTruthy();
  });

  it("renders Trademark page at /legal/trademark", async () => {
    render(
      <MemoryRouter initialEntries={["/legal/trademark"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Trademark" })).toBeTruthy();
  });
});

describe("App routing", () => {
  it("bootstraps current user once per app mount", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Good (morning|afternoon|evening), Nurse/i)).toBeTruthy();
    await waitFor(() => {
      expect(fetchMeMock).toHaveBeenCalledTimes(1);
    });
  });

  it("renders login page at / for signed-out users", async () => {
    fetchMeMock.mockReset();
    fetchMeMock.mockRejectedValue(new Error("Unauthorized"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Organize clients and plan better daily routes/i,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("renders home page at / for signed-in users", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Good (morning|afternoon|evening), Nurse/i)).toBeTruthy();
    expect(screen.getByText(/Add a home address for default start and end points/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows required legal notice modal and acknowledges it", async () => {
    fetchLegalNoticeStatusMock.mockResolvedValueOnce({
      required: true,
      currentVersion: "2026-04-16",
      acceptedVersion: null,
      acceptedAt: null,
    });
    acknowledgeLegalNoticeMock.mockResolvedValueOnce({
      required: false,
      currentVersion: "2026-04-16",
      acceptedVersion: "2026-04-16",
      acceptedAt: "2026-04-16T12:00:00.000Z",
    });
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Important Notice - Client Data Use" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "I Agree" }));

    await waitFor(() => {
      expect(acknowledgeLegalNoticeMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Important Notice - Client Data Use" }),
      ).toBeNull();
    });
  });

  it("renders client names in today's schedule", async () => {
    fetchDashboardSummaryMock.mockReset();
    fetchDashboardSummaryMock.mockResolvedValue({
      asOf: "2026-04-16T12:00:00.000Z",
      timezone: "America/Toronto",
      kpis: {
        routesToday: 1,
        visitsScheduledToday: 2,
        visitsScheduledLast7Days: 12,
        activePatientCount: 24,
        templatedActivePatientCount: 8,
        deletedClientsLast30Days: 1,
        driveHoursLast7Days: 2.1,
        totalDistanceKm7d: 35.2,
        onTimeRatePercent7d: 92,
        unscheduledVisitsToday: 0,
        driveHoursToday: 2.1,
      },
      alerts: [],
      upcomingStops: [
        {
          time: "10:45 AM",
          route: "R-ABCD",
          patientName: null,
          destination: "Stop 1",
          status: "on_track",
        },
      ],
      trend: [
        { date: "2026-04-10", label: "Fri", onTimeRatePercent: 88 },
        { date: "2026-04-11", label: "Sat", onTimeRatePercent: 84 },
        { date: "2026-04-12", label: "Sun", onTimeRatePercent: 90 },
        { date: "2026-04-13", label: "Mon", onTimeRatePercent: 94 },
        { date: "2026-04-14", label: "Tue", onTimeRatePercent: 91 },
        { date: "2026-04-15", label: "Wed", onTimeRatePercent: 93 },
        { date: "2026-04-16", label: "Thu", onTimeRatePercent: 92 },
      ],
      snapshot: {
        completedRoutes: 1,
        delayedRoutes: 0,
        unscheduledVisits: 0,
        totalDistanceKm: 12.8,
      },
    });
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("10:45 AM · Client")).toBeTruthy();
    expect(screen.getByText("Stop 1")).toBeTruthy();
  });

  it("shows dashboard error state and supports retry on the home page", async () => {
    fetchDashboardSummaryMock.mockReset();
    fetchDashboardSummaryMock
      .mockRejectedValueOnce(new Error("Unable to load dashboard summary."))
      .mockResolvedValueOnce({
        asOf: "2026-04-16T12:05:00.000Z",
        timezone: "America/Toronto",
        kpis: {
          routesToday: 2,
          visitsScheduledToday: 8,
          visitsScheduledLast7Days: 31,
          activePatientCount: 24,
          templatedActivePatientCount: 10,
          deletedClientsLast30Days: 0,
          driveHoursLast7Days: 5.5,
          totalDistanceKm7d: 88.1,
          onTimeRatePercent7d: 91,
          unscheduledVisitsToday: 0,
          driveHoursToday: 5.5,
        },
        alerts: [],
        upcomingStops: [],
        trend: [
          { date: "2026-04-10", label: "Fri", onTimeRatePercent: 88 },
          { date: "2026-04-11", label: "Sat", onTimeRatePercent: 84 },
          { date: "2026-04-12", label: "Sun", onTimeRatePercent: 90 },
          { date: "2026-04-13", label: "Mon", onTimeRatePercent: 94 },
          { date: "2026-04-14", label: "Tue", onTimeRatePercent: 91 },
          { date: "2026-04-15", label: "Wed", onTimeRatePercent: 93 },
          { date: "2026-04-16", label: "Thu", onTimeRatePercent: 92 },
        ],
        snapshot: {
          completedRoutes: 2,
          delayedRoutes: 0,
          unscheduledVisits: 0,
          totalDistanceKm: 33.8,
        },
      });
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard data unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry Dashboard" }));

    await waitFor(() => {
      expect(fetchDashboardSummaryMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText("Dashboard data unavailable")).toBeNull();
    });
    expect(await screen.findByText("8 visits planned")).toBeTruthy();
  });

  it("renders route planner at /route-planner and marks nav active", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/route-planner"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Smart Route Planner" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Route Planner" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("prefills route planner start and end from saved home address", async () => {
    fetchMeMock.mockResolvedValue({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: "3361 Ingram Road, Mississauga, ON",
      },
    });
    seedAuthenticatedSession("Nurse One", "3361 Ingram Road, Mississauga, ON");

    render(
      <MemoryRouter initialEntries={["/route-planner"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Smart Route Planner" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox", { name: /starting point/i })).toHaveProperty(
      "value",
      "3361 Ingram Road, Mississauga, ON",
    );
    expect(screen.getByRole("textbox", { name: /ending point/i })).toHaveProperty(
      "value",
      "3361 Ingram Road, Mississauga, ON",
    );
  });
});
