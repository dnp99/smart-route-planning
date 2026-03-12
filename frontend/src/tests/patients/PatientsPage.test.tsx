import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PatientsPage from "../../components/patients/PatientsPage";

vi.mock("../../components/patients/patientService", () => ({
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
}));

import {
  createPatient,
  deletePatient,
  listPatients,
} from "../../components/patients/patientService";

const mockedListPatients = vi.mocked(listPatients);
const mockedCreatePatient = vi.mocked(createPatient);
const mockedDeletePatient = vi.mocked(deletePatient);

const seedPatient = {
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: null,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "11:00:00",
  visitTimeType: "fixed" as const,
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

describe("PatientsPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockedListPatients.mockReset();
    mockedCreatePatient.mockReset();
    mockedDeletePatient.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    } as Response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("loads and selects a patient into edit mode", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Jane Doe/i }));

    expect(screen.getByText("Edit Patient")).toBeTruthy();
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Jane");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("Doe");
  });

  it("submits create flow and resets to empty create mode", async () => {
    mockedListPatients.mockResolvedValue([]);
    mockedCreatePatient.mockResolvedValue(seedPatient);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save new patient/i }));

    await waitFor(() => {
      expect(mockedCreatePatient).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Create Patient")).toBeTruthy();
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("");
  });

  it("deletes selected patient after confirmation", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);
    mockedDeletePatient.mockResolvedValue({ deleted: true, id: "patient-1" });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Jane Doe/i }));
    fireEvent.click(screen.getByRole("button", { name: /Delete patient/i }));

    await waitFor(() => {
      expect(mockedDeletePatient).toHaveBeenCalledWith("patient-1");
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText("Create Patient")).toBeTruthy();

    confirmSpy.mockRestore();
  });
});
