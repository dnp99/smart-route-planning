import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteResultSection } from "../../features/route-planner/ui/RouteResultSection";
import type { OptimizeRouteResponse } from "../../components/types";

vi.mock("../../features/route-planner/ui/OptimizedRouteResult", () => ({
  OptimizedRouteResult: ({
    breakGapThresholdMinutes,
    showOptimizeFlash,
  }: {
    breakGapThresholdMinutes?: number;
    showOptimizeFlash?: boolean;
  }) => (
    <div data-testid="optimized-route-result">
      Optimized Route Result {String(breakGapThresholdMinutes ?? "")} {String(showOptimizeFlash)}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const buildProps = () => ({
  isMobileViewport: false,
  hasValidTripAddresses: false,
  destinationCount: 0,
  selectedDestinationsCount: 0,
  resolvedEndAddress: "",
  isLoading: false,
  canOptimize: true,
  result: null as OptimizeRouteResponse | null,
  hasChangedSinceLastOptimize: true,
  showOptimizeSuccess: false,
  showOptimizeFlash: false,
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
  it("shows one sticky Optimize bar with contextual hints (mobile, single-column)", () => {
    const props = buildProps();
    props.isMobileViewport = true;
    props.canOptimize = false;

    const { rerender } = render(<RouteResultSection {...props} />);

    // No trip yet → hint + disabled Optimize button (no step-wizard / Continue buttons).
    expect(screen.getByText("Add a starting and ending point to optimize.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue to/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Optimize Route" })).toHaveProperty("disabled", true);

    // Trip set, no clients → client hint.
    props.hasValidTripAddresses = true;
    rerender(<RouteResultSection {...props} />);
    expect(screen.getByText("Add at least one client to optimize.")).toBeTruthy();

    // Ready → hint gone, button enabled.
    props.selectedDestinationsCount = 2;
    props.canOptimize = true;
    rerender(<RouteResultSection {...props} />);
    expect(screen.queryByText(/Add at least one client/)).toBeNull();
    expect(screen.getByRole("button", { name: "Optimize Route" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("renders optimize CTA states and warnings/errors (mobile)", () => {
    // On desktop the CTA lives in PatientSelectorSection; this test covers mobile.
    const props = buildProps();
    props.isMobileViewport = true;
    props.hasValidTripAddresses = true;
    props.selectedDestinationsCount = 1;

    const { rerender } = render(<RouteResultSection {...props} />);

    expect(screen.getByRole("button", { name: "Optimize Route" })).toBeTruthy();

    props.isLoading = true;
    rerender(<RouteResultSection {...props} />);
    expect(screen.getByRole("button", { name: "Optimizing..." })).toBeTruthy();
    expect(screen.getByTestId("optimized-route-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("optimized-route-result")).toBeNull();

    props.isLoading = false;
    props.result = { mock: true } as unknown as OptimizeRouteResponse;
    props.hasChangedSinceLastOptimize = false;
    props.showOptimizeFlash = true;
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
    expect(screen.getByText(/true$/)).toBeTruthy();
  });
});
