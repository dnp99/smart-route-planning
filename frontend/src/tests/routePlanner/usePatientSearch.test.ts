import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/patients/patientService", () => ({
  listPatients: vi.fn(),
}));

import { listPatients } from "../../components/patients/patientService";
import { usePatientSearch } from "../../components/hooks/usePatientSearch";

const mockedListPatients = vi.mocked(listPatients);

const mockPatient = {
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: null,
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "10:00:00",
  visitTimeType: "fixed" as const,
  visitWindows: [],
  createdAt: "2026-03-12T00:00:00.000Z",
  updatedAt: "2026-03-12T00:00:00.000Z",
};

describe("usePatientSearch", () => {
  beforeEach(() => {
    mockedListPatients.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty, idle state when disabled", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      usePatientSearch({
        query: "jane",
        enabled: false,
      }),
    );

    expect(result.current.patients).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(mockedListPatients).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("loads patients after debounce when enabled", async () => {
    mockedListPatients.mockResolvedValue([mockPatient]);

    const { result } = renderHook(() =>
      usePatientSearch({
        query: "j",
        enabled: true,
      }),
    );

    await waitFor(() => {
      expect(mockedListPatients).toHaveBeenCalledWith("j");
      expect(result.current.patients).toEqual([mockPatient]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("");
    });
  });

  it("stores fallback error when patient search fails with non-Error value", async () => {
    mockedListPatients.mockRejectedValue("network");

    const { result } = renderHook(() =>
      usePatientSearch({
        query: "jane",
        enabled: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.patients).toEqual([]);
      expect(result.current.error).toBe("Unable to load patients.");
      expect(result.current.isLoading).toBe(false);
    });
  });
});
