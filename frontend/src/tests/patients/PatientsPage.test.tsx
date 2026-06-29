import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PatientsPage from "../../features/patients/ui/PatientsPage";

vi.mock("../../features/patients/api/patientService", () => ({
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
  fetchStaleClients: vi.fn().mockResolvedValue({ snoozedUntil: null, patients: [] }),
  archiveClients: vi.fn().mockResolvedValue([]),
  dismissStaleReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../features/patients/api/recurringVisitTemplateService", () => ({
  listRecurringVisitTemplates: vi.fn(),
  createRecurringVisitTemplate: vi.fn(),
  updateRecurringVisitTemplate: vi.fn(),
  deleteRecurringVisitTemplate: vi.fn(),
}));

import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "../../features/patients/api/patientService";
import {
  createRecurringVisitTemplate,
  deleteRecurringVisitTemplate,
  listRecurringVisitTemplates,
  updateRecurringVisitTemplate,
} from "../../features/patients/api/recurringVisitTemplateService";

const mockedListPatients = vi.mocked(listPatients);
const mockedCreatePatient = vi.mocked(createPatient);
const mockedDeletePatient = vi.mocked(deletePatient);
const mockedUpdatePatient = vi.mocked(updatePatient);
const mockedListRecurringVisitTemplates = vi.mocked(listRecurringVisitTemplates);
const mockedCreateRecurringVisitTemplate = vi.mocked(createRecurringVisitTemplate);
const mockedUpdateRecurringVisitTemplate = vi.mocked(updateRecurringVisitTemplate);
const mockedDeleteRecurringVisitTemplate = vi.mocked(deleteRecurringVisitTemplate);

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

const seedRecurringTemplate = {
  id: "template-1",
  nurseId: "nurse-1",
  patientId: "patient-1",
  name: "Weekdays",
  timezone: "America/Toronto",
  recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  startDate: "2026-03-20",
  endDate: null,
  isActive: true,
  daysOfWeek: [1],
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
    mockedListRecurringVisitTemplates.mockReset();
    mockedCreateRecurringVisitTemplate.mockReset();
    mockedUpdateRecurringVisitTemplate.mockReset();
    mockedDeleteRecurringVisitTemplate.mockReset();
    mockedListRecurringVisitTemplates.mockResolvedValue([]);
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

    fireEvent.click(await screen.findByRole("button", { name: "Edit Jane Doe" }));

    expect(screen.getByText("Edit Client")).toBeTruthy();
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Jane");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("Doe");
  });

  it("renders the client summary stats row with derived counts", async () => {
    // seedPatient: fixed / 30 min, secondPatient: flexible / 45 min
    mockedListPatients.mockResolvedValue([seedPatient, secondPatient]);

    render(<PatientsPage />);

    const statsRow = await screen.findByTestId("client-stats");
    const cardFor = (label: string) =>
      within(statsRow).getByText(label).closest("div") as HTMLElement;

    expect(within(cardFor("Total Clients")).getByText("2")).toBeTruthy();
    expect(within(cardFor("Fixed Window")).getByText("1")).toBeTruthy();
    expect(within(cardFor("Flexible")).getByText("1")).toBeTruthy();
    // round((30 + 45) / 2) = 38
    const avgCard = cardFor("Avg Duration");
    expect(avgCard.textContent).toContain("38");
    expect(avgCard.textContent).toContain("min");
  });

  it("filters via the All/Fixed/Flexible toggle and shows the repeat badge", async () => {
    // seedPatient: Jane Doe (fixed) with an active template; secondPatient: John Smith (flexible)
    mockedListPatients.mockResolvedValue([seedPatient, secondPatient]);
    mockedListRecurringVisitTemplates.mockResolvedValue([seedRecurringTemplate]);

    render(<PatientsPage />);

    expect((await screen.findAllByText("Jane Doe")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    // Jane Doe (patient-1) has one active recurring template → repeat badge
    expect(screen.getByTitle("1 active recurring template")).toBeTruthy();

    // Filter to Fixed → the flexible client drops out
    fireEvent.click(screen.getAllByRole("button", { name: "Fixed" })[0]);
    expect(screen.queryByText("John Smith")).toBeNull();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
  });

  it("submits create flow and resets to empty create mode", async () => {
    mockedListPatients.mockResolvedValue([]);
    mockedCreatePatient.mockResolvedValue(seedPatient);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

    await waitFor(() => {
      expect(mockedCreatePatient).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("creates recurring template after creating client when recurrence is authored", async () => {
    mockedListPatients.mockResolvedValue([]);
    mockedCreatePatient.mockResolvedValue(seedPatient);
    mockedCreateRecurringVisitTemplate.mockResolvedValue(seedRecurringTemplate);

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add recurring template" }));
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-03-20" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

    await waitFor(() => {
      expect(mockedCreateRecurringVisitTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: "patient-1",
          startDate: "2026-03-20",
          daysOfWeek: [1],
          timezone: expect.any(String),
        }),
      );
    });
  });

  it("sends updated daysOfWeek when editing an existing recurring template", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);
    mockedListRecurringVisitTemplates.mockResolvedValue([seedRecurringTemplate]);
    mockedUpdatePatient.mockResolvedValue(seedPatient);
    mockedUpdateRecurringVisitTemplate.mockResolvedValue({
      ...seedRecurringTemplate,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU",
      daysOfWeek: [1, 2],
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
      expect(mockedListRecurringVisitTemplates).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit Jane Doe" }));

    fireEvent.click(screen.getByRole("button", { name: "Tue" }));
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mockedUpdateRecurringVisitTemplate).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          patientId: "patient-1",
          recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU",
          daysOfWeek: [1, 2],
        }),
      );
    });
  });

  it("splits an existing template when the start date moves forward", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);
    mockedListRecurringVisitTemplates.mockResolvedValue([seedRecurringTemplate]);
    mockedUpdatePatient.mockResolvedValue(seedPatient);
    mockedCreateRecurringVisitTemplate.mockResolvedValue({
      ...seedRecurringTemplate,
      id: "template-2",
      startDate: "2026-04-10",
    });
    mockedUpdateRecurringVisitTemplate.mockResolvedValue({
      ...seedRecurringTemplate,
      endDate: "2026-04-09",
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
      expect(mockedListRecurringVisitTemplates).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit Jane Doe" }));

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-04-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mockedUpdateRecurringVisitTemplate).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          endDate: "2026-04-09",
        }),
      );
      expect(mockedCreateRecurringVisitTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: "patient-1",
          startDate: "2026-04-10",
          daysOfWeek: [1],
        }),
      );
    });
  });

  it("ends an existing template from a chosen date forward", async () => {
    mockedListPatients.mockResolvedValue([seedPatient]);
    mockedListRecurringVisitTemplates.mockResolvedValue([seedRecurringTemplate]);
    mockedUpdatePatient.mockResolvedValue(seedPatient);
    mockedUpdateRecurringVisitTemplate.mockResolvedValue({
      ...seedRecurringTemplate,
      endDate: "2026-04-09",
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
      expect(mockedListRecurringVisitTemplates).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit Jane Doe" }));

    fireEvent.change(screen.getByLabelText("End from date forward"), {
      target: { value: "2026-04-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mockedUpdateRecurringVisitTemplate).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          endDate: "2026-04-09",
        }),
      );
    });
    expect(mockedCreateRecurringVisitTemplate).not.toHaveBeenCalled();
  });

  it("deletes selected patient after confirmation", async () => {
    mockedListPatients.mockResolvedValueOnce([seedPatient]).mockResolvedValue([]);
    mockedDeletePatient.mockResolvedValue({ deleted: true, id: "patient-1" });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("");
    });

    fireEvent.click(await screen.findByRole("button", { name: "Delete Jane Doe" }));

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

    fireEvent.change(screen.getByLabelText("Search clients"), {
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

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
    fireEvent.change(screen.getByPlaceholderText("Search and select an address"), {
      target: { value: "123 Main St" },
    });

    // Save is disabled when required name fields are empty
    expect(
      (screen.getByRole("button", { name: /Save new client/i }) as HTMLButtonElement).disabled,
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

    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

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

    fireEvent.click(screen.getByRole("button", { name: /Add Client/ }));
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

    fireEvent.click(screen.getByRole("button", { name: /Save new client/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Jane Doe fixed window must be at least 90 minutes long as per client's profile.",
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

    fireEvent.click(await screen.findByRole("button", { name: "Edit Jane Doe" }));
    fireEvent.change(screen.getByLabelText("Visit duration (minutes)"), {
      target: { value: "130" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Jane Doe fixed window must be at least 130 minutes long as per client's profile.",
        ),
      ).toBeTruthy();
      expect(mockedUpdatePatient).not.toHaveBeenCalled();
    });
  });
});
