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
  updatePatient,
} from "../../components/patients/patientService";

const mockedListPatients = vi.mocked(listPatients);
const mockedCreatePatient = vi.mocked(createPatient);
const mockedDeletePatient = vi.mocked(deletePatient);
const mockedUpdatePatient = vi.mocked(updatePatient);

const seedPatient = {
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: null,
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "11:00:00",
  visitTimeType: "fixed" as const,
  visitWindows: [
    {
      id: "window-1",
      startTime: "09:00:00",
      endTime: "11:00:00",
      visitTimeType: "fixed" as const,
    },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const secondPatient = {
  id: "patient-2",
  nurseId: "nurse-1",
  firstName: "John",
  lastName: "Smith",
  address: "456 Queen St",
  googlePlaceId: null,
  visitDurationMinutes: 45,
  preferredVisitStartTime: "10:00:00",
  preferredVisitEndTime: "12:00:00",
  visitTimeType: "flexible" as const,
  visitWindows: [
    {
      id: "window-2",
      startTime: "10:00:00",
      endTime: "12:00:00",
      visitTimeType: "flexible" as const,
    },
  ],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

describe("PatientsPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockedListPatients.mockReset();
    mockedCreatePatient.mockReset();
    mockedDeletePatient.mockReset();
    mockedUpdatePatient.mockReset();
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

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Open actions for Jane Doe/i }))[0],
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Edit patient Jane Doe/i })[0]);

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

    fireEvent.click(screen.getByRole("button", { name: /Add Patient/ }));
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

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("deletes selected patient after confirmation", async () => {
    mockedListPatients.mockResolvedValueOnce([seedPatient]).mockResolvedValue([]);
    mockedDeletePatient.mockResolvedValue({ deleted: true, id: "patient-1" });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Open actions for Jane Doe/i }))[0],
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete patient Jane Doe/i }));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockedDeletePatient).toHaveBeenCalledWith("patient-1");
    });
  });

  it("filters by first/last name substring as user types", async () => {
    mockedListPatients.mockImplementation(async (query: string) => {
      const normalized = query.trim().toLowerCase();
      const allPatients = [seedPatient, secondPatient];

      if (!normalized) {
        return allPatients;
      }

      return allPatients.filter((patient) => {
        return (
          patient.firstName.toLowerCase().indexOf(normalized) !== -1 ||
          patient.lastName.toLowerCase().indexOf(normalized) !== -1
        );
      });
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
      expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Search patients"), {
      target: { value: "smi" },
    });

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenLastCalledWith("smi");
      expect(screen.queryAllByText("Jane Doe")).toHaveLength(0);
      expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    });
  });

  it("keeps duplicate patient names distinguishable by address", async () => {
    mockedListPatients.mockResolvedValue([
      seedPatient,
      {
        ...seedPatient,
        id: "patient-duplicate",
        address: "789 Dundas St",
      },
    ]);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("123 Main St").length).toBeGreaterThan(0);
      expect(screen.getAllByText("789 Dundas St").length).toBeGreaterThan(0);
    });
  });

  it("renders patient names with capitalized first letters", async () => {
    mockedListPatients.mockResolvedValue([
      {
        ...seedPatient,
        firstName: "jane",
        lastName: "doe",
      },
    ]);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    });
  });

  it("shows validation errors for missing names and invalid time window", async () => {
    mockedListPatients.mockResolvedValue([]);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Patient/ }));
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });

    // Save is disabled when required name fields are empty
    expect(
      (screen.getByRole("button", { name: /Save new patient/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mockedCreatePatient).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByLabelText("Preferred visit start"), {
      target: { value: "11:00" },
    });
    fireEvent.change(screen.getByLabelText("Preferred visit end"), {
      target: { value: "10:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save new patient/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "End time must be later than start time (cross-midnight windows are not supported).",
        ),
      ).toBeTruthy();
      expect(mockedCreatePatient).not.toHaveBeenCalled();
    });
  });

  it("shows fixed-window duration validation while adding a patient", async () => {
    mockedListPatients.mockResolvedValue([]);

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
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByLabelText("Visit duration (minutes)"), {
      target: { value: "90" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save new patient/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Jane Doe fixed window must be at least 90 minutes long as per patient's profile.",
        ),
      ).toBeTruthy();
      expect(mockedCreatePatient).not.toHaveBeenCalled();
    });
  });

  it("shows fixed-window duration validation while editing a patient", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Open actions for Jane Doe/i }))[0],
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Edit patient Jane Doe/i })[0]);
    fireEvent.change(screen.getByLabelText("Visit duration (minutes)"), {
      target: { value: "130" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Jane Doe fixed window must be at least 130 minutes long as per patient's profile.",
        ),
      ).toBeTruthy();
      expect(mockedUpdatePatient).not.toHaveBeenCalled();
    });
  });
});
