import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../../features/admin/ui/AdminDashboardPage";
import type { AdminMetrics, AdminNurseSummary } from "../../features/admin/api/adminService";

const metrics: AdminMetrics = {
  nurses: { total: 3, active: 2 },
  signups: { total: 3, last7Days: 1, last30Days: 3 },
  activeNurses: { dau: 1, wau: 2 },
  clientsAdded: { last7Days: 5, last30Days: 12 },
  routeRuns: { last7Days: 4, last30Days: 9 },
  templateCoverage: { covered: 2, total: 8 },
  onboarding: { neverLoggedIn: 1, noClients: 2 },
  signupTrend: [{ date: "2026-07-01", count: 2 }],
};

const nurse: AdminNurseSummary = {
  id: "nurse-1",
  email: "nurse@example.com",
  displayName: "Nurse One",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-07-01T10:00:00.000Z",
  lastLoginAt: "2026-07-03T09:00:00.000Z",
  lastActivityAt: "2026-07-03T09:30:00.000Z",
  activePatientCount: 4,
};

const baseProps = {
  nurses: [nurse],
  metrics,
  isLoading: false,
  error: "",
  onSelectNurse: () => undefined,
};

describe("AdminDashboardPage", () => {
  afterEach(cleanup);

  it("renders KPI values and the nurse row", () => {
    render(<AdminDashboardPage {...baseProps} />);
    expect(screen.getByText("New signups (7d)")).toBeTruthy();
    expect(screen.getByText("Nurse One")).toBeTruthy();
    expect(screen.getByText("nurse@example.com")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders the new metric cards, signup chart, and onboarding follow-up", () => {
    render(<AdminDashboardPage {...baseProps} />);
    expect(screen.getByText("Route runs (7d)")).toBeTruthy();
    expect(screen.getByText("Template coverage")).toBeTruthy();
    expect(screen.getByText("2 / 8")).toBeTruthy();
    expect(screen.getByText("New signups")).toBeTruthy();
    expect(screen.getByText("Onboarding follow-up")).toBeTruthy();
    expect(screen.getByText("never logged in")).toBeTruthy();
  });

  it("invokes onSelectNurse when a row is clicked", () => {
    const onSelectNurse = vi.fn();
    render(<AdminDashboardPage {...baseProps} onSelectNurse={onSelectNurse} />);
    fireEvent.click(screen.getByText("Nurse One"));
    expect(onSelectNurse).toHaveBeenCalledWith("nurse-1");
  });

  it("shows an empty state when there are no nurses", () => {
    render(<AdminDashboardPage {...baseProps} nurses={[]} />);
    expect(screen.getByText("No nurses yet.")).toBeTruthy();
  });

  it("surfaces an error banner", () => {
    render(<AdminDashboardPage {...baseProps} error="Unable to load the dashboard." />);
    expect(screen.getByText("Unable to load the dashboard.")).toBeTruthy();
  });
});
