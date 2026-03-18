import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { setAuthSession } from "../components/auth/authSession";

const { fetchMeMock, updateProfileHomeAddressMock } = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
  updateProfileHomeAddressMock: vi.fn(),
}));

vi.mock("../components/auth/authService", () => ({
  fetchMe: fetchMeMock,
  updateProfileHomeAddress: updateProfileHomeAddressMock,
  login: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("../components/AddressAutocompleteInput", () => ({
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
  fetchMeMock.mockReset();
  updateProfileHomeAddressMock.mockReset();
  fetchMeMock.mockResolvedValue({
    user: {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      homeAddress: null,
    },
  });
  updateProfileHomeAddressMock.mockResolvedValue({
    user: {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      homeAddress: "1 Main Street, Toronto, ON",
    },
  });
});

afterEach(() => {
  window.localStorage.clear();
  cleanup();
});

const seedAuthenticatedSession = (displayName = "Nurse One", homeAddress: string | null = null) => {
  setAuthSession("test-token", {
    id: "nurse-1",
    email: "nurse@example.com",
    displayName,
    homeAddress,
  });
};

describe("App routing", () => {
  it("renders route planner at /route-planner and marks nav active", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/route-planner"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Smart Route Planner" })).toBeTruthy();
    expect(screen.getByText("Nurse operations workspace for Nurse One")).toBeTruthy();
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
    expect(screen.getByRole("textbox", { name: /starting point/i })).toHaveProperty(
      "value",
      "3361 Ingram Road, Mississauga, ON",
    );
    expect(screen.getByRole("textbox", { name: /ending point/i })).toHaveProperty(
      "value",
      "3361 Ingram Road, Mississauga, ON",
    );
  });

  it("capitalizes nurse display name in the workspace subtitle", async () => {
    fetchMeMock.mockResolvedValue({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "nUrSe oNe",
        homeAddress: null,
      },
    });
    seedAuthenticatedSession("nUrSe oNe");

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^Patients \(\d+\)$/ })).toBeTruthy();
    expect(screen.getByText("Nurse operations workspace for Nurse One")).toBeTruthy();
  });

  it("renders patients page at /patients and marks nav active", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^Patients \(\d+\)$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Patients" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("shows account options menu items", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^Patients \(\d+\)$/ })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Logout" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open account options menu" }));

    expect(screen.getByRole("menuitem", { name: "Account settings" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeTruthy();
  });

  it("opens account settings modal and saves home address", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^Patients \(\d+\)$/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open account options menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Account settings" }));

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: /home address/i }), {
      target: { value: "1 Main Street, Toronto, ON" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateProfileHomeAddressMock).toHaveBeenCalledWith(
        "test-token",
        "1 Main Street, Toronto, ON",
      );
    });
    expect(await screen.findByText("Account settings saved.")).toBeTruthy();
  });

  it("redirects unauthenticated users to login", () => {
    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Login" })).toBeTruthy();
  });

  it("clears stale sessions when current user lookup fails", async () => {
    fetchMeMock.mockRejectedValue(new Error("Unauthorized"));
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Login" })).toBeTruthy();
  });
});
