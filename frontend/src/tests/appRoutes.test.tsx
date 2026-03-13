import { cleanup, render, screen } from "@testing-library/react";
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

const seedAuthenticatedSession = () => {
  setAuthSession("test-token", {
    id: "nurse-1",
    email: "nurse@example.com",
    displayName: "Nurse One",
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
    expect(screen.getByRole("link", { name: "Route Planner" }).getAttribute("aria-current")).toBe(
      "page",
    );
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
