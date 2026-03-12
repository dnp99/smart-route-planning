import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "../../components/patients/patientService";

vi.mock("../../components/apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

describe("patientService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists patients using backend query parameter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        patients: [
          {
            id: "patient-1",
            nurseId: "nurse-1",
            firstName: "Jane",
            lastName: "Doe",
            address: "123 Main St",
            googlePlaceId: null,
            preferredVisitStartTime: "09:00:00",
            preferredVisitEndTime: "11:00:00",
            visitTimeType: "fixed",
            createdAt: "2026-03-12T12:00:00.000Z",
            updatedAt: "2026-03-12T12:00:00.000Z",
          },
        ],
      }),
    } as Response);

    const patients = await listPatients("jane");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/patients?query=jane", {
      method: "GET",
    });
    expect(patients).toHaveLength(1);
    expect(patients[0].firstName).toBe("Jane");
  });

  it("creates a patient and sends JSON payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "patient-1",
        nurseId: "nurse-1",
        firstName: "Jane",
        lastName: "Doe",
        address: "123 Main St",
        googlePlaceId: "place-1",
        preferredVisitStartTime: "09:00:00",
        preferredVisitEndTime: "11:00:00",
        visitTimeType: "fixed",
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      }),
    } as Response);

    const created = await createPatient({
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-1",
      preferredVisitStartTime: "09:00",
      preferredVisitEndTime: "11:00",
      visitTimeType: "fixed",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        address: "123 Main St",
        googlePlaceId: "place-1",
        preferredVisitStartTime: "09:00",
        preferredVisitEndTime: "11:00",
        visitTimeType: "fixed",
      }),
    });
    expect(created.id).toBe("patient-1");
  });

  it("updates a patient and surfaces backend errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Patient not found." }),
    } as Response);

    await expect(
      updatePatient("patient-1", {
        address: "456 Queen St",
      }),
    ).rejects.toThrow("Patient not found.");
  });

  it("deletes a patient and validates response shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true, id: "patient-1" }),
    } as Response);

    const result = await deletePatient("patient-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/patients/patient-1",
      { method: "DELETE" },
    );
    expect(result).toEqual({ deleted: true, id: "patient-1" });
  });
});
