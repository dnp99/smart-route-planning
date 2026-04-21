import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomeSetupPage from "../../features/onboarding/ui/WelcomeSetupPage";

const {
  updateProfileMock,
  updateWorkingHoursMock,
  updateOptimizationObjectiveMock,
  setStoredAuthUserMock,
} = vi.hoisted(() => ({
  updateProfileMock: vi.fn(),
  updateWorkingHoursMock: vi.fn(),
  updateOptimizationObjectiveMock: vi.fn(),
  setStoredAuthUserMock: vi.fn(),
}));

vi.mock("../../components/auth/authService", () => ({
  updateProfile: updateProfileMock,
  updateWorkingHours: updateWorkingHoursMock,
  updateOptimizationObjective: updateOptimizationObjectiveMock,
  fetchMe: vi.fn(),
  login: vi.fn(),
  signUp: vi.fn(),
  updateProfileHomeAddress: vi.fn(),
}));

vi.mock("../../components/auth/authSession", () => ({
  setStoredAuthUser: setStoredAuthUserMock,
}));

vi.mock("../../components/shared/AddressAutocompleteInput", () => ({
  default: ({
    id,
    label,
    value,
    onChange,
    disabled,
    errorText,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    errorText?: string;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        disabled={Boolean(disabled)}
        onChange={(event) => onChange((event.target as HTMLInputElement).value)}
      />
      {errorText ? <p>{errorText}</p> : null}
    </div>
  ),
}));

describe("WelcomeSetupPage", () => {
  beforeEach(() => {
    updateProfileMock.mockReset();
    updateWorkingHoursMock.mockReset();
    updateOptimizationObjectiveMock.mockReset();
    setStoredAuthUserMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves profile then advances to working-hours step", async () => {
    updateProfileMock.mockResolvedValueOnce({
      user: {
        id: "n1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: "123 Main St",
        isSetupComplete: false,
        setupMissing: ["workingHours"],
      },
    });

    render(
      <MemoryRouter>
        <WelcomeSetupPage
          authUser={{
            id: "n1",
            email: "nurse@example.com",
            displayName: "",
            homeAddress: null,
            isSetupComplete: false,
            setupMissing: ["displayName", "homeAddress", "workingHours"],
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /display name/i }), {
      target: { value: "Nurse One" },
    });
    fireEvent.change(screen.getByLabelText("Home address"), {
      target: { value: "123 Main St" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        displayName: "Nurse One",
        homeAddress: "123 Main St",
      });
    });
    expect(setStoredAuthUserMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Enable break reminders")).toBeTruthy();
  });

  it("submits working-hours step", async () => {
    updateWorkingHoursMock.mockResolvedValueOnce({
      user: {
        id: "n1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: "123 Main St",
        isSetupComplete: false,
        setupMissing: ["optimizationObjective"],
      },
    });

    render(
      <MemoryRouter>
        <WelcomeSetupPage
          authUser={{
            id: "n1",
            email: "nurse@example.com",
            displayName: "Nurse One",
            homeAddress: "123 Main St",
            isSetupComplete: false,
            setupMissing: ["workingHours", "optimizationObjective"],
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(updateWorkingHoursMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Route priority")).toBeTruthy();
  });

  it("completes setup and redirects to /home", async () => {
    updateOptimizationObjectiveMock.mockResolvedValueOnce({
      user: {
        id: "n1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: "123 Main St",
        isSetupComplete: true,
        setupMissing: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/welcome-setup"]}>
        <Routes>
          <Route
            path="/welcome-setup"
            element={
              <WelcomeSetupPage
                authUser={{
                  id: "n1",
                  email: "nurse@example.com",
                  displayName: "Nurse One",
                  homeAddress: "123 Main St",
                  isSetupComplete: false,
                  setupMissing: ["optimizationObjective"],
                }}
              />
            }
          />
          <Route path="/home" element={<h1>Home Page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Complete setup" }));

    await waitFor(() => {
      expect(updateOptimizationObjectiveMock).toHaveBeenCalledWith("distance");
    });
    expect(await screen.findByRole("heading", { name: "Home Page" })).toBeTruthy();
  });

  it("shows red validation errors when required profile fields are missing", async () => {
    render(
      <MemoryRouter>
        <WelcomeSetupPage
          authUser={{
            id: "n1",
            email: "nurse@example.com",
            displayName: "",
            homeAddress: null,
            isSetupComplete: false,
            setupMissing: ["displayName", "homeAddress"],
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /display name/i }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Home address"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await screen.findByText("Display name is required.")).toBeTruthy();
    expect(screen.getByText("Home address is required.")).toBeTruthy();
  });
});
