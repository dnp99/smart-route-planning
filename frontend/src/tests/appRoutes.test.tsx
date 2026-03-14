import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { setAuthSession } from "../components/auth/authSession";

const { fetchMeMock } = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
}));

vi.mock("../components/auth/authService", () => ({
  fetchMe: fetchMeMock,
  login: vi.fn(),
  signUp: vi.fn(),
}));

beforeEach(() => {
  fetchMeMock.mockReset();
  fetchMeMock.mockResolvedValue({
    user: {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
    },
  });
});

afterEach(() => {
  window.localStorage.clear();
  cleanup();
});

const seedAuthenticatedSession = (displayName = "Nurse One") => {
  setAuthSession("test-token", {
    id: "nurse-1",
    email: "nurse@example.com",
    displayName,
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

  it("capitalizes nurse display name in the workspace subtitle", async () => {
    fetchMeMock.mockResolvedValue({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "nUrSe oNe",
      },
    });
    seedAuthenticatedSession("nUrSe oNe");

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Patients" })).toBeTruthy();
    expect(screen.getByText("Nurse operations workspace for Nurse One")).toBeTruthy();
  });

  it("renders patients page at /patients and marks nav active", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Patients" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Patients" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("shows logout option when logout icon menu is opened", async () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Patients" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Logout" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open logout menu" }));

    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeTruthy();
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
