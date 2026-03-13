import {
  isPatient,
  parseListPatientsResponse,
  type CreatePatientRequest,
  type DeletePatientResponse,
  type Patient,
  type UpdatePatientRequest,
} from "../../../../shared/contracts";
import { requestAuthedJson } from "../auth/authFetch";

const requestJson = async (path: string, init: RequestInit, fallbackMessage: string) => {
  return requestAuthedJson(path, init, fallbackMessage);
};

export const listPatients = async (query: string): Promise<Patient[]> => {
  const searchParams = new URLSearchParams();
  if (query.trim()) {
    searchParams.set("query", query.trim());
  }

  const querySuffix = searchParams.toString();
  const path = querySuffix ? `/api/patients?${querySuffix}` : "/api/patients";
  const payload = await requestJson(path, { method: "GET" }, "Unable to load patients.");

  return parseListPatientsResponse(payload).patients;
};

export const createPatient = async (request: CreatePatientRequest): Promise<Patient> => {
  const payload = await requestJson(
    "/api/patients",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Unable to create patient.",
  );

  if (!isPatient(payload)) {
    throw new Error("Unexpected patient response format.");
  }

  return payload;
};

export const updatePatient = async (
  patientId: string,
  request: UpdatePatientRequest,
): Promise<Patient> => {
  const payload = await requestJson(
    `/api/patients/${encodeURIComponent(patientId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Unable to update patient.",
  );

  if (!isPatient(payload)) {
    throw new Error("Unexpected patient response format.");
  }

  return payload;
};

export const deletePatient = async (patientId: string): Promise<DeletePatientResponse> => {
  const payload = await requestJson(
    `/api/patients/${encodeURIComponent(patientId)}`,
    {
      method: "DELETE",
    },
    "Unable to delete patient.",
  );

  if (
    typeof payload !== "object" ||
    payload === null ||
    payload.deleted !== true ||
    typeof payload.id !== "string"
  ) {
    throw new Error("Unexpected delete response format.");
  }

  return payload;
};
