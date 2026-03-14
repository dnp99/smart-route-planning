import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "../../components/patients/patientService";
import { setAuthSession } from "../../components/auth/authSession";

vi.mock("../../components/apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

describe("patientService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    setAuthSession("test-token", {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
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
            visitDurationMinutes: 30,
            preferredVisitStartTime: "09:00:00",
            preferredVisitEndTime: "11:00:00",
            visitTimeType: "fixed",
            visitWindows: [
              {
                id: "window-1",
                startTime: "09:00:00",
                endTime: "11:00:00",
                visitTimeType: "fixed",
              },
            ],
            createdAt: "2026-03-12T12:00:00.000Z",
            updatedAt: "2026-03-12T12:00:00.000Z",
          },
        ],
      }),
    } as Response);

    const patients = await listPatients("jane");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/patients?query=jane",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const [, listInit] = fetchMock.mock.calls[0];
    expect(new Headers(listInit.headers).get("Authorization")).toBe("Bearer test-token");
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
        visitDurationMinutes: 45,
        preferredVisitStartTime: "09:00:00",
        preferredVisitEndTime: "11:00:00",
        visitTimeType: "fixed",
        visitWindows: [
          {
            id: "window-1",
            startTime: "09:00:00",
            endTime: "11:00:00",
            visitTimeType: "fixed",
          },
        ],
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      }),
    } as Response);

    const created = await createPatient({
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-1",
      visitDurationMinutes: 45,
      visitWindows: [
        {
          startTime: "09:00",
          endTime: "11:00",
          visitTimeType: "fixed",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/patients",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          firstName: "Jane",
          lastName: "Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          visitDurationMinutes: 45,
          visitWindows: [
            {
              startTime: "09:00",
              endTime: "11:00",
              visitTimeType: "fixed",
            },
          ],
        }),
      }),
    );
    const [, createInit] = fetchMock.mock.calls[0];
    const createHeaders = new Headers(createInit.headers);
    expect(createHeaders.get("Content-Type")).toBe("application/json");
    expect(createHeaders.get("Authorization")).toBe("Bearer test-token");
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
      expect.objectContaining({
        method: "DELETE",
        headers: expect.any(Headers),
      }),
    );
    const [, deleteInit] = fetchMock.mock.calls[0];
    expect(new Headers(deleteInit.headers).get("Authorization")).toBe("Bearer test-token");
    expect(result).toEqual({ deleted: true, id: "patient-1" });
  });
});
