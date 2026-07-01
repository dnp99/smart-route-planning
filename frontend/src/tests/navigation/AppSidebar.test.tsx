import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppSidebar from "../../components/navigation/AppSidebar";

const renderSidebar = (isSettingsActive: boolean) =>
  render(
    <MemoryRouter>
      <AppSidebar
        authUser={{ displayName: "Mei Su" }}
        isSettingsActive={isSettingsActive}
        onOpenAccountSettings={() => {}}
        onLogout={() => {}}
      />
    </MemoryRouter>,
  );

describe("AppSidebar", () => {
  afterEach(cleanup);

  it("marks the Settings row active while its modal is open", () => {
    const { rerender } = renderSidebar(false);
    expect(screen.getByRole("button", { name: "Settings" }).getAttribute("data-active")).toBe(
      "false",
    );

    rerender(
      <MemoryRouter>
        <AppSidebar
          authUser={{ displayName: "Mei Su" }}
          isSettingsActive
          onOpenAccountSettings={() => {}}
          onLogout={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Settings" }).getAttribute("data-active")).toBe(
      "true",
    );
  });

  it("account card menu offers Logout only (settings lives in the Settings row)", () => {
    renderSidebar(false);
    fireEvent.click(screen.getByRole("button", { name: /Mei Su/ }));

    expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Account settings/i })).toBeNull();
  });
});
