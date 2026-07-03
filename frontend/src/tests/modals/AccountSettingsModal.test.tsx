import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountSettingsModal from "../../components/modals/AccountSettingsModal";
import type { AuthUser } from "../../../../shared/contracts";

const authUser: AuthUser = {
  id: "nurse-1",
  email: "nurse@example.com",
  displayName: "Test Nurse",
  homeAddress: null,
};

const renderModal = (initialTab?: "profile" | "working-hours" | "route") =>
  render(
    <AccountSettingsModal
      isOpen
      initialTab={initialTab}
      onClose={vi.fn()}
      authUser={authUser}
      onHomeAddressSaved={vi.fn()}
    />,
  );

// The save button label is unique per tab, so it doubles as a reliable signal of
// which tab is active on open.
describe("AccountSettingsModal initial tab", () => {
  afterEach(cleanup);

  it("opens on the Profile tab by default", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull();
  });

  it("deep-links to the Working hours tab when requested (e.g. from 'Set hours')", () => {
    renderModal("working-hours");
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull();
  });

  it("deep-links to the Route tab when requested", () => {
    renderModal("route");
    expect(screen.getByRole("button", { name: "Save route" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull();
  });

  it("auto-focuses the Home address input when the route-planner nudge requests it", async () => {
    render(
      <AccountSettingsModal
        isOpen
        initialTab="profile"
        initialFocusField="home-address"
        onClose={vi.fn()}
        authUser={authUser}
        onHomeAddressSaved={vi.fn()}
      />,
    );
    const input = document.getElementById("account-settings-home-address");
    expect(input).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("does not steal focus when no field is requested", async () => {
    render(
      <AccountSettingsModal
        isOpen
        initialTab="profile"
        onClose={vi.fn()}
        authUser={authUser}
        onHomeAddressSaved={vi.fn()}
      />,
    );
    const input = document.getElementById("account-settings-home-address");
    // Give any deferred focus a chance to run, then confirm it stayed put.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).not.toBe(input);
  });

  it("falls back to Profile (never an empty body) for an unexpected tab value", () => {
    // e.g. a caller wiring onClick={onOpenAccountSettings} passes a click Event.
    render(
      <AccountSettingsModal
        isOpen
        // @ts-expect-error — deliberately invalid to exercise the guard
        initialTab={{ nativeEvent: true }}
        onClose={vi.fn()}
        authUser={authUser}
        onHomeAddressSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
  });
});
