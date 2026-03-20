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
  window.localStorage.clear();
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
  window.sessionStorage.clear();
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

const waitForPatientsPage = async () => {
  await screen.findByRole("button", { name: "Add patient" });
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

    expect(screen.getByRole("link", { name: "Contact Us" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "License" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trademark" })).toBeTruthy();
  });

  it("footer Contact Us links to the support email", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    await waitForPatientsPage();

    expect(screen.getByRole("link", { name: "Contact Us" }).getAttribute("href")).toBe(
      "mailto:dpatel1995@yahoo.com",
    );
  });

});

describe("Legal pages", () => {
  it("renders Terms page at /legal/terms", () => {
    render(
      <MemoryRouter initialEntries={["/legal/terms"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Terms of Use" })).toBeTruthy();
  });

  it("renders Privacy page at /legal/privacy", () => {
    render(
      <MemoryRouter initialEntries={["/legal/privacy"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
  });

  it("renders License page at /legal/license", () => {
    render(
      <MemoryRouter initialEntries={["/legal/license"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "License" })).toBeTruthy();
  });

  it("renders Trademark page at /legal/trademark", () => {
    render(
      <MemoryRouter initialEntries={["/legal/trademark"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Trademark" })).toBeTruthy();
  });
});

describe("App routing", () => {
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

    await waitForPatientsPage();
    expect(screen.getByRole("heading", { name: /^Patients \(\d+\)$/ })).toBeTruthy();
    expect(screen.getByText("Nurse operations workspace for Nurse One")).toBeTruthy();
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
