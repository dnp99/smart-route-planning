import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppRoutes from "../../components/navigation/AppRoutes";

const routePlannerMock = vi.fn(() => <h1>Route Planner Mock</h1>);

vi.mock("../../components/LandingPage", () => ({
  default: () => <h1>Landing Page Mock</h1>,
}));

vi.mock("../../components/HomePage", () => ({
  default: () => <h1>Home Page Mock</h1>,
}));

vi.mock("../../features/patients/ui/PatientsPage", () => ({
  default: () => <h1>Clients Page Mock</h1>,
}));

vi.mock("../../features/route-planner/ui/RoutePlanner", () => ({
  default: (props: unknown) => {
    routePlannerMock(props);
    return <h1>Route Planner Mock</h1>;
  },
}));

vi.mock("../../components/auth/LoginPage", () => ({
  default: () => <h1>Login Page Mock</h1>,
}));

vi.mock("../../components/legal/TermsPage", () => ({
  default: () => <h1>Terms Page Mock</h1>,
}));

vi.mock("../../components/legal/PrivacyPage", () => ({
  default: () => <h1>Privacy Page Mock</h1>,
}));

vi.mock("../../components/legal/LicensePage", () => ({
  default: () => <h1>License Page Mock</h1>,
}));

vi.mock("../../components/legal/TrademarkPage", () => ({
  default: () => <h1>Trademark Page Mock</h1>,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-pathname">{location.pathname}</div>;
};

afterEach(() => {
  cleanup();
});

const buildProps = (overrides: Record<string, unknown> = {}) => ({
  isAuthenticated: false,
  isBootstrapping: false,
  authUser: null,
  onOpenAccountSettings: vi.fn(),
  optimizationObjective: "distance",
  defaultProtectedPath: "/home",
  ...overrides,
});

describe("AppRoutes", () => {
  it("renders landing page for signed-out users on /", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes {...buildProps()} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Landing Page Mock" })).toBeTruthy();
  });

  it("redirects signed-in users from / to /home", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes {...buildProps({ isAuthenticated: true, authUser: { id: "u1" } })} />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Home Page Mock" })).toBeTruthy();
    expect(screen.getByTestId("location-pathname").textContent).toBe("/home");
  });

  it("redirects /patients to /clients", async () => {
    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <AppRoutes {...buildProps({ isAuthenticated: true, authUser: { id: "u1" } })} />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Clients Page Mock" })).toBeTruthy();
    expect(screen.getByTestId("location-pathname").textContent).toBe("/clients");
  });

  it("passes nurse settings and objective into RoutePlanner route", async () => {
    const onOpenAccountSettings = vi.fn();
    routePlannerMock.mockClear();
    render(
      <MemoryRouter initialEntries={["/route-planner"]}>
        <AppRoutes
          {...buildProps({
            isAuthenticated: true,
            authUser: {
              id: "u1",
              homeAddress: "1 Main St",
              workingHours: { monday: { enabled: true, start: "08:00", end: "16:00" } },
              breakGapThresholdMinutes: 45,
            },
            optimizationObjective: "time",
            onOpenAccountSettings,
          })}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Route Planner Mock" })).toBeTruthy();
    expect(routePlannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nurseHomeAddress: "1 Main St",
        nurseWorkingHours: expect.any(Object),
        nurseBreakGapThresholdMinutes: 45,
        onOpenAccountSettings,
        optimizationObjective: "time",
      }),
    );
  });

  it("renders legal pages in modal when backgroundLocation is present", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/legal/terms",
            state: { backgroundLocation: { pathname: "/home" } },
          },
        ]}
      >
        <AppRoutes {...buildProps({ isAuthenticated: true, authUser: { id: "u1" } })} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Home Page Mock" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Terms Page Mock" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close legal document" })).toBeTruthy();
  });
});
