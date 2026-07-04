import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForcedPasswordChange from "../../components/auth/ForcedPasswordChange";

const setup = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  const onSignOut = vi.fn();
  render(<ForcedPasswordChange onSubmit={onSubmit} onSignOut={onSignOut} />);
  const fill = (labelText: string, value: string) => {
    const input = screen.getByText(labelText).parentElement?.querySelector("input");
    if (!input) throw new Error(`no input for ${labelText}`);
    fireEvent.change(input, { target: { value } });
  };
  return { onSubmit, onSignOut, fill };
};

describe("ForcedPasswordChange", () => {
  afterEach(cleanup);

  it("blocks submit when the new password and confirmation differ", () => {
    const { onSubmit, fill } = setup();
    fill("Current (temporary) password", "TempPass123");
    fill("New password", "brandnew123");
    fill("Confirm new password", "different999");
    fireEvent.click(screen.getByText("Save new password"));
    expect(screen.getByText("New password and confirmation do not match.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a too-short new password", () => {
    const { onSubmit, fill } = setup();
    fill("Current (temporary) password", "TempPass123");
    fill("New password", "short");
    fill("Confirm new password", "short");
    fireEvent.click(screen.getByText("Save new password"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits current + new password when valid", () => {
    const { onSubmit, fill } = setup();
    fill("Current (temporary) password", "TempPass123");
    fill("New password", "brandnew123");
    fill("Confirm new password", "brandnew123");
    fireEvent.click(screen.getByText("Save new password"));
    expect(onSubmit).toHaveBeenCalledWith("TempPass123", "brandnew123");
  });

  it("fires sign out", () => {
    const { onSignOut } = setup();
    fireEvent.click(screen.getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalled();
  });
});
