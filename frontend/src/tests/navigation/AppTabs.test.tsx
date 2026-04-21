import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import AppTabs from "../../components/navigation/AppTabs";

afterEach(() => {
  cleanup();
});

describe("AppTabs", () => {
  it("renders all primary navigation tabs", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <AppTabs />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/home");
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("href")).toBe("/clients");
    expect(screen.getByRole("link", { name: "Route Planner" }).getAttribute("href")).toBe(
      "/route-planner",
    );
  });

  it("marks Home as active on /home", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <AppTabs />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Clients as active on /clients", () => {
    render(
      <MemoryRouter initialEntries={["/clients"]}>
        <AppTabs />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });
});
