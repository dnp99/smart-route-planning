import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteResultSection } from "../../components/routePlanner/RouteResultSection";
import type { OptimizeRouteResponse } from "../../components/types";

vi.mock("../../components/routePlanner/OptimizedRouteResult", () => ({
  OptimizedRouteResult: ({ breakGapThresholdMinutes }: { breakGapThresholdMinutes?: number }) => (
    <div data-testid="optimized-route-result">
      Optimized Route Result {String(breakGapThresholdMinutes ?? "")}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const buildProps = () => ({
  isMobileViewport: false,
  activeMobileStep: "trip" as const,
  onSetActiveMobileStep: vi.fn(),
  isReviewStepVisible: false,
  hasValidTripAddresses: false,
  destinationCount: 0,
  selectedDestinationsCount: 0,
  resolvedEndAddress: "",
  isLoading: false,
  canOptimize: true,
  result: null as OptimizeRouteResponse | null,
  hasChangedSinceLastOptimize: true,
  showOptimizeSuccess: false,
  optimizeEndpointHint: "",
  localValidationError: "",
  optimizeError: "",
  orderedStops: [],
  routeLegs: [],
  isManualOrderStale: false,
  unscheduledResubmitCount: 0,
  onMoveStop: vi.fn(),
  canMoveStop: vi.fn(() => true),
  onResetManualOrder: vi.fn(),
  onRecalculateManualOrder: vi.fn(async () => {}),
  isRecalculatingManualOrder: false,
  conflictWarningsDismissed: false,
  onDismissConflictWarnings: vi.fn(),
  latenessWarningsDismissed: false,
  onDismissLatenessWarnings: vi.fn(),
  expandedResultTaskIds: {},
  onToggleResultTask: vi.fn(),
  expandedResultEndingStopIds: {},
  onToggleResultEndingStop: vi.fn(),
  normalizedHomeAddress: "",
  breakGapThresholdMinutes: 30,
  planningDate: "2026-03-26",
});

describe("RouteResultSection", () => {
  it("shows mobile trip-step CTA and hint state correctly", () => {
    const props = buildProps();
    props.isMobileViewport = true;
    props.activeMobileStep = "trip";

    const { rerender } = render(<RouteResultSection {...props} />);

    expect(screen.getByText("Add a starting and ending point to continue.")).toBeTruthy();
    const continueButton = screen.getByRole("button", { name: "Continue to Patients →" });
    expect(continueButton).toHaveProperty("disabled", true);

    props.hasValidTripAddresses = true;
    rerender(<RouteResultSection {...props} />);
    const enabledContinueButton = screen.getByRole("button", { name: "Continue to Patients →" });
    expect(enabledContinueButton).toHaveProperty("disabled", false);
    fireEvent.click(enabledContinueButton);
    expect(props.onSetActiveMobileStep).toHaveBeenCalledWith("patients");
  });

  it("shows mobile patients-step CTA and review card actions", () => {
    const props = buildProps();
    props.isMobileViewport = true;
    props.activeMobileStep = "patients";

    const { rerender } = render(<RouteResultSection {...props} />);

    expect(screen.getByText("Add at least one patient to continue.")).toBeTruthy();
    const continueButton = screen.getByRole("button", { name: "Continue to Review →" });
    expect(continueButton).toHaveProperty("disabled", true);

    props.selectedDestinationsCount = 2;
    props.destinationCount = 2;
    props.isReviewStepVisible = true;
    props.activeMobileStep = "review";
    rerender(<RouteResultSection {...props} />);

    expect(screen.getByText("Ready to optimize")).toBeTruthy();
    expect(screen.getByText("2 destination(s) included • ending point missing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit patients" }));
    expect(props.onSetActiveMobileStep).toHaveBeenCalledWith("trip");
    expect(props.onSetActiveMobileStep).toHaveBeenCalledWith("patients");
  });

  it("renders optimize CTA states and warnings/errors (mobile)", () => {
    // On desktop the CTA lives in PatientSelectorSection; this test covers mobile.
    const props = buildProps();
    props.isMobileViewport = true;
    props.isReviewStepVisible = true;
    props.destinationCount = 1;
    props.activeMobileStep = "review";

    const { rerender } = render(<RouteResultSection {...props} />);

    expect(screen.getByRole("button", { name: "Optimize Route" })).toBeTruthy();

    props.isLoading = true;
    rerender(<RouteResultSection {...props} />);
    expect(screen.getByRole("button", { name: "Optimizing..." })).toBeTruthy();

    props.isLoading = false;
    props.result = { mock: true } as unknown as OptimizeRouteResponse;
    props.hasChangedSinceLastOptimize = false;
    props.optimizeEndpointHint = "Endpoint hint";
    props.localValidationError = "Local warning";
    props.optimizeError = "Optimize failure";
    rerender(<RouteResultSection {...props} />);

    const reoptimizeButton = screen.getByRole("button", { name: "Re-optimize Route" });
    expect(reoptimizeButton).toHaveProperty("disabled", true);
    expect(screen.getByText("Endpoint hint")).toBeTruthy();
    expect(screen.getByText("Local warning")).toBeTruthy();
    expect(screen.getByText("Optimize failure")).toBeTruthy();
    expect(screen.getByTestId("optimized-route-result")).toBeTruthy();
  });
});
