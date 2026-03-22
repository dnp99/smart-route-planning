import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/patients/patientService", () => ({
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
}));

vi.mock("../../components/AddressAutocompleteInput", () => ({
  default: ({
    id,
    label,
    value,
    onChange,
    onSuggestionSelect,
    onSuggestionPick,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSuggestionSelect?: (value: string) => void;
    onSuggestionPick?: (suggestion: { displayName: string; placeId: string }) => void;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange((event.target as HTMLInputElement).value)}
      />
      <button
        type="button"
        onClick={() => {
          onChange("11 Test Rd");
          onSuggestionSelect?.("11 Test Rd");
          onSuggestionPick?.({ displayName: "11 Test Rd", placeId: "place-xyz" });
        }}
      >
        Pick suggested address
      </button>
    </div>
  ),
}));

import { createPatient, listPatients } from "../../components/patients/patientService";
import PatientsPage from "../../components/patients/PatientsPage";

const mockedListPatients = vi.mocked(listPatients);
const mockedCreatePatient = vi.mocked(createPatient);

describe("PatientsPage address autocomplete integration", () => {
  beforeEach(() => {
    mockedListPatients.mockReset();
    mockedCreatePatient.mockReset();
    mockedListPatients.mockResolvedValue([]);
    mockedCreatePatient.mockResolvedValue({
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "11 Test Rd",
      googlePlaceId: "place-xyz",
      visitDurationMinutes: 30,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "10:00:00",
      visitTimeType: "fixed",
      visitWindows: [
        {
          id: "window-1",
          startTime: "09:00:00",
          endTime: "10:00:00",
          visitTimeType: "fixed" as const,
        },
      ],
      createdAt: "2026-03-12T12:00:00.000Z",
      updatedAt: "2026-03-12T12:00:00.000Z",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits selected Google Place id from address suggestion", async () => {
    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Patient/ }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pick suggested address" }));
    fireEvent.click(screen.getByRole("button", { name: /Save new patient/i }));

    await waitFor(() => {
      expect(mockedCreatePatient).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "11 Test Rd",
          googlePlaceId: "place-xyz",
        }),
      );
    });
  });
});
