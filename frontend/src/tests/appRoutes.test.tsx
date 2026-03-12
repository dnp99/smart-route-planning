import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { setAuthSession } from "../components/auth/authSession";

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
  it("renders route planner at /route-planner and marks nav active", () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/route-planner"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Smart Route Planner" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Route Planner" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("renders patients page at /patients and marks nav active", () => {
    seedAuthenticatedSession();

    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Patients" })).toBeTruthy();
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
});
