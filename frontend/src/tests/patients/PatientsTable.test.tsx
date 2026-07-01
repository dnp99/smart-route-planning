import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientsTable } from "../../features/patients/ui/PatientsTable";

const longPatient = {
  id: "p1",
  nurseId: "n1",
  firstName: "Alexandria",
  lastName: "Featherstonehaugh-Worthington",
  address: "1600 Pennsylvania Avenue Northwest, Washington, DC",
  googlePlaceId: null,
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "10:00:00",
  visitTimeType: "fixed" as const,
  visitWindows: [
    { id: "w1", startTime: "09:00:00", endTime: "10:00:00", visitTimeType: "fixed" as const },
    { id: "w2", startTime: "13:00:00", endTime: "14:00:00", visitTimeType: "fixed" as const },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const baseProps = {
  isLoading: false,
  isSubmitting: false,
  patients: [longPatient],
  lifecycleState: "active" as const,
  searchQuery: "",
  windowFilter: "all" as const,
  onWindowFilterChange: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  selectedIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onArchiveSelected: vi.fn(),
  isBulkArchiving: false,
  onRestore: vi.fn(),
  restoringId: null,
  recurringTemplatesByPatientId: new Map(),
};

describe("PatientsTable desktop", () => {
  afterEach(cleanup);

  it("exposes full name and address via title so truncated cells stay readable", () => {
    render(<PatientsTable {...baseProps} />);
    expect(screen.getAllByTitle(/featherstonehaugh-worthington/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByTitle("1600 Pennsylvania Avenue Northwest, Washington, DC").length,
    ).toBeGreaterThan(0);
  });

  it("opens the +N more windows popover (portaled to body) and closes on Escape", () => {
    render(<PatientsTable {...baseProps} />);

    // Only the first window shows inline; the second lives behind "+1 more".
    expect(screen.queryByText(/1:00.*2:00.*PM/)).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /\+1 more/ })[0]);
    expect(screen.getByText(/1:00.*2:00.*PM/)).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(/1:00.*2:00.*PM/)).toBeNull();
  });
});
