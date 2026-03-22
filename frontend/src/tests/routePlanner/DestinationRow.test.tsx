import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationRow } from "../../components/routePlanner/DestinationRow";
import type { SelectedPatientDestination } from "../../components/routePlanner/routePlannerTypes";

const buildDestination = (overrides: Partial<SelectedPatientDestination> = {}): SelectedPatientDestination => ({
  visitKey: "visit-1",
  sourceWindowId: null,
  patientId: "patient-1",
  patientName: "Alex Johnson",
  address: "10 First Avenue, Toronto, ON",
  googlePlaceId: null,
  windowStart: "09:00",
  windowEnd: "11:00",
  windowType: "fixed",
  serviceDurationMinutes: 30,
  requiresPlanningWindow: false,
  isIncluded: true,
  persistPlanningWindow: false,
  ...overrides,
});

const defaultProps = {
  index: 0,
  isExpanded: false,
  onToggleDetails: vi.fn(),
  onRemove: vi.fn(),
  onSetIncluded: vi.fn(),
  onUpdateWindow: vi.fn(),
  onSetPersistWindow: vi.fn(),
};

describe("DestinationRow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the patient name and index", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} />);
    expect(screen.getByText("Alex Johnson")).toBeTruthy();
    expect(screen.getByText("1.")).toBeTruthy();
  });

  it("clicking the name opens the patient info modal", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    expect(screen.getByText("10 First Avenue, Toronto, ON")).toBeTruthy();
    expect(screen.getByText("09:00 – 11:00")).toBeTruthy();
  });

  it("shows the fixed pill in the modal", () => {
    render(<DestinationRow destination={buildDestination({ windowType: "fixed" })} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    expect(screen.getByText("fixed")).toBeTruthy();
  });

  it("shows the flexible pill in the modal", () => {
    render(<DestinationRow destination={buildDestination({ windowType: "flexible" })} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    expect(screen.getByText("flexible")).toBeTruthy();
  });

  it("shows 'No window set' when windowStart and windowEnd are empty", () => {
    render(
      <DestinationRow
        destination={buildDestination({ windowStart: "", windowEnd: "" })}
        {...defaultProps}
      />,
    );
    fireEvent.click(screen.getByText("Alex Johnson"));
    expect(screen.getByText("No window set")).toBeTruthy();
  });

  it("pressing Escape closes the modal", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    expect(screen.getByText("10 First Avenue, Toronto, ON")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("10 First Avenue, Toronto, ON")).toBeNull();
  });

  it("clicking the backdrop closes the modal", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    const allDivs = document.querySelectorAll("div");
    const backdropEl = Array.from(allDivs).find(el => el.className.indexOf("fixed") !== -1 && el.className.indexOf("inset-0") !== -1);
    if (backdropEl) fireEvent.click(backdropEl);
    expect(screen.queryByText("10 First Avenue, Toronto, ON")).toBeNull();
  });

  it("clicking the X button closes the modal", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} />);
    fireEvent.click(screen.getByText("Alex Johnson"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("10 First Avenue, Toronto, ON")).toBeNull();
  });

  it("clicking Remove calls onRemove", () => {
    const onRemove = vi.fn();
    render(<DestinationRow destination={buildDestination()} {...defaultProps} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Alex Johnson" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("clicking Edit window calls onToggleDetails", () => {
    const onToggleDetails = vi.fn();
    render(<DestinationRow destination={buildDestination()} {...defaultProps} onToggleDetails={onToggleDetails} />);
    fireEvent.click(screen.getByRole("button", { name: /edit window/i }));
    expect(onToggleDetails).toHaveBeenCalledTimes(1);
  });

  it("shows edit form when isExpanded is true", () => {
    render(<DestinationRow destination={buildDestination()} {...defaultProps} isExpanded={true} />);
    expect(screen.getByLabelText("Alex Johnson start")).toBeTruthy();
    expect(screen.getByLabelText("Alex Johnson end")).toBeTruthy();
    expect(screen.getByText("Hide details")).toBeTruthy();
  });

  it("applies opacity when isIncluded is false", () => {
    render(<DestinationRow destination={buildDestination({ isIncluded: false })} {...defaultProps} />);
    const li = screen.getByText("Alex Johnson").closest("li");
    expect(li?.className).toContain("opacity-60");
  });
});
