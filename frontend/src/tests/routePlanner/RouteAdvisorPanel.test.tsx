import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteAdvisorPanel } from "../../features/route-planner/ui/RouteAdvisorPanel";

const baseProps = {
  advice: null,
  isLoading: false,
  error: "",
  unavailable: false,
  onRequestAdvice: () => undefined,
};

describe("RouteAdvisorPanel", () => {
  afterEach(cleanup);

  it("renders nothing when the advisor is unavailable (no server key)", () => {
    const { container } = render(<RouteAdvisorPanel {...baseProps} unavailable />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the Get AI advice button in the idle state and fires the callback", () => {
    const onRequestAdvice = vi.fn();
    render(<RouteAdvisorPanel {...baseProps} onRequestAdvice={onRequestAdvice} />);

    const button = screen.getByRole("button", { name: /Get AI advice/i });
    fireEvent.click(button);
    expect(onRequestAdvice).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state and hides the button while a request is in flight", () => {
    render(<RouteAdvisorPanel {...baseProps} isLoading />);

    expect(screen.getByText(/Getting route advice/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Get AI advice/i })).toBeNull();
  });

  it("renders the brief and each suggestion when advice is present", () => {
    render(
      <RouteAdvisorPanel
        {...baseProps}
        advice={{
          brief: "Your day wraps by 2:30 PM.",
          suggestions: ["Confirm Stop 1 can flex.", "Leave 10 minutes earlier."],
        }}
      />,
    );

    expect(screen.getByText("Your day wraps by 2:30 PM.")).toBeTruthy();
    expect(screen.getByText("Confirm Stop 1 can flex.")).toBeTruthy();
    expect(screen.getByText("Leave 10 minutes earlier.")).toBeTruthy();
    // No button once advice has arrived.
    expect(screen.queryByRole("button", { name: /Get AI advice/i })).toBeNull();
  });

  it("shows a subtle error and a retry affordance on failure", () => {
    render(<RouteAdvisorPanel {...baseProps} error="Unable to get route advice." />);

    expect(screen.getByText("Unable to get route advice.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy();
  });
});
