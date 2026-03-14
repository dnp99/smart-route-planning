import { describe, expect, it } from "vitest";
import type { Patient, PatientVisitWindow } from "../../db/schema";
import { toPatientDto } from "./patientDto";

describe("toPatientDto", () => {
  it("maps patient rows to API DTO format", () => {
    const createdAt = new Date("2026-03-12T10:00:00.000Z");
    const updatedAt = new Date("2026-03-12T10:30:00.000Z");

    const patient: Patient = {
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-1",
      visitDurationMinutes: 30,
      preferredVisitStartTime: "14:00:00",
      preferredVisitEndTime: "16:30:00",
      visitTimeType: "fixed",
      createdAt,
      updatedAt,
    };

    const visitWindows: PatientVisitWindow[] = [
      {
        id: "window-1",
        patientId: "patient-1",
        startTime: "14:00:00",
        endTime: "16:30:00",
        visitTimeType: "fixed",
        createdAt,
        updatedAt,
      },
    ];

    expect(toPatientDto({ ...patient, visitWindows })).toEqual({
      id: "patient-1",
      nurseId: "nurse-1",
      firstName: "Jane",
      lastName: "Doe",
      address: "123 Main St",
      googlePlaceId: "place-1",
      visitDurationMinutes: 30,
      preferredVisitStartTime: "14:00",
      preferredVisitEndTime: "16:30",
      visitTimeType: "fixed",
      visitWindows: [
        {
          id: "window-1",
          startTime: "14:00",
          endTime: "16:30",
          visitTimeType: "fixed",
        },
      ],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("keeps flexible visit type and null place id", () => {
    const patient: Patient = {
      id: "patient-2",
      nurseId: "nurse-2",
      firstName: "John",
      lastName: "Smith",
      address: "456 Queen St",
      googlePlaceId: null,
      visitDurationMinutes: 45,
      preferredVisitStartTime: "09:00:00",
      preferredVisitEndTime: "11:00:00",
      visitTimeType: "flexible",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T01:00:00.000Z"),
    };

    const visitWindows: PatientVisitWindow[] = [
      {
        id: "window-2",
        patientId: "patient-2",
        startTime: "09:00:00",
        endTime: "11:00:00",
        visitTimeType: "flexible",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        updatedAt: new Date("2026-03-12T01:00:00.000Z"),
      },
    ];

    expect(toPatientDto({ ...patient, visitWindows }).visitTimeType).toBe("flexible");
    expect(toPatientDto({ ...patient, visitWindows }).googlePlaceId).toBeNull();
  });

  it("preserves empty visitWindows for flexible patients with no preferred window", () => {
    const patient: Patient = {
      id: "patient-3",
      nurseId: "nurse-1",
      firstName: "Flex",
      lastName: "Patient",
      address: "789 King St",
      googlePlaceId: null,
      visitDurationMinutes: 20,
      preferredVisitStartTime: "00:00:00",
      preferredVisitEndTime: "23:59:00",
      visitTimeType: "flexible",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T01:00:00.000Z"),
    };

    expect(toPatientDto({ ...patient, visitWindows: [] }).visitWindows).toEqual([]);
  });
});
