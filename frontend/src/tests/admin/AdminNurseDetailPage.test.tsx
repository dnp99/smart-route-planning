import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminNurseDetailPage from "../../features/admin/ui/AdminNurseDetailPage";
import type { AdminNurseDetail } from "../../features/admin/api/adminService";

const detail: AdminNurseDetail = {
  nurse: {
    id: "nurse-1",
    email: "nurse@example.com",
    displayName: "Nurse One",
    isActive: true,
    mustChangePassword: false,
    homeAddress: "1 Main St",
    createdAt: "2026-07-01T10:00:00.000Z",
    lastLoginAt: "2026-07-03T09:00:00.000Z",
  },
  patients: [
    {
      id: "patient-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "27 Bathurst St",
      isActive: true,
      archivedAt: null,
      createdAt: "2026-07-02T10:00:00.000Z",
    },
  ],
  activity: [
    {
      id: "evt-1",
      action: "patients.create",
      resourceType: "patient",
      resourceId: "patient-1",
      outcome: "success",
      metadata: {},
      ipAddress: "1.2.3.4",
      userAgent: null,
      createdAt: "2026-07-02T10:00:00.000Z",
    },
  ],
};

const baseProps = {
  detail,
  isLoading: false,
  error: "",
  onBack: () => undefined,
};

describe("AdminNurseDetailPage", () => {
  afterEach(cleanup);

  it("renders profile, patient PHI, and a humanized activity feed", () => {
    render(<AdminNurseDetailPage {...baseProps} />);
    expect(screen.getByText("Nurse One")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("27 Bathurst St")).toBeTruthy();
    expect(screen.getByText("Added a client")).toBeTruthy();
  });

  it("fires onBack when the back link is clicked", () => {
    const onBack = vi.fn();
    render(<AdminNurseDetailPage {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByText("← Back to users"));
    expect(onBack).toHaveBeenCalled();
  });

  it("surfaces an error", () => {
    render(
      <AdminNurseDetailPage {...baseProps} detail={null} error="Unable to load this nurse." />,
    );
    expect(screen.getByText("Unable to load this nurse.")).toBeTruthy();
  });
});
