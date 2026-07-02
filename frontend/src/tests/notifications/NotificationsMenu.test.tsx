import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NotificationsMenu from "../../components/notifications/NotificationsMenu";
import { __resetNotificationsCache } from "../../components/notifications/useNotifications";
import { fetchDashboardSummary } from "../../components/home/homeDashboardService";
import type { DashboardSummaryResponse } from "../../../../shared/contracts";

vi.mock("../../components/home/homeDashboardService", () => ({
  fetchDashboardSummary: vi.fn(),
}));

const mockedFetchSummary = vi.mocked(fetchDashboardSummary);

const summaryWith = (stale: number): DashboardSummaryResponse =>
  ({
    asOf: "2026-07-02T00:00:00.000Z",
    timezone: "UTC",
    kpis: {
      routesToday: 0,
      visitsScheduledToday: 0,
      visitsScheduledLast7Days: 0,
      onTimeRatePercent7d: null,
      staleClientsCount: stale,
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
    snapshot: { completedRoutes: 0, delayedRoutes: 0, unscheduledVisits: 0, totalDistanceKm: 0 },
  }) as DashboardSummaryResponse;

const renderMenu = (onOpenAccountSettings = () => {}) =>
  render(
    <MemoryRouter>
      <NotificationsMenu authUser={null} onOpenAccountSettings={onOpenAccountSettings} />
    </MemoryRouter>,
  );

describe("NotificationsMenu", () => {
  beforeEach(() => {
    __resetNotificationsCache();
    localStorage.clear();
    mockedFetchSummary.mockReset();
    mockedFetchSummary.mockResolvedValue(summaryWith(2));
  });

  afterEach(cleanup);

  it("shows the unread dot when there are items, then clears it on open", async () => {
    renderMenu();
    const bell = screen.getByRole("button", { name: "Notifications" });

    // authUser=null → setup item exists immediately → unread dot present.
    await waitFor(() => expect(bell.querySelector("span")).toBeTruthy());

    fireEvent.click(bell);
    // Opening marks everything read → dot removed.
    await waitFor(() => expect(bell.querySelector("span")).toBeNull());
  });

  it("opens a panel listing the setup and idle notifications", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Finish setting up")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("2 idle clients")).toBeTruthy());
    expect(screen.getByText("2 idle clients").closest("a")?.getAttribute("href")).toBe(
      "/clients?state=idle",
    );
  });

  it("shows an empty state when there is nothing to surface", async () => {
    // Working hours configured + clean summary → no items.
    mockedFetchSummary.mockResolvedValue(summaryWith(0));
    render(
      <MemoryRouter>
        <NotificationsMenu
          authUser={{ workingHours: { monday: { enabled: true } } as never }}
          onOpenAccountSettings={() => {}}
        />
      </MemoryRouter>,
    );

    const bell = screen.getByRole("button", { name: "Notifications" });
    await waitFor(() => expect(mockedFetchSummary).toHaveBeenCalled());
    fireEvent.click(bell);
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });
});
