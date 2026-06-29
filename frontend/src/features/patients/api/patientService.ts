import {
  isPatient,
  parseListPatientsResponse,
  type CreatePatientRequest,
  type DeletePatientResponse,
  type Patient,
  type UpdatePatientRequest,
} from "../../../../../shared/contracts";
import { requestAuthedJson } from "../../../components/auth/authFetch";

const requestJson = async (path: string, init: RequestInit, fallbackMessage: string) => {
  return requestAuthedJson(path, init, fallbackMessage);
};

export type PatientLifecycleState = "active" | "idle" | "archived";

export const listPatients = async (
  query: string,
  state: PatientLifecycleState = "active",
): Promise<Patient[]> => {
  const searchParams = new URLSearchParams();
  if (query.trim()) {
    searchParams.set("query", query.trim());
  }
  if (state !== "active") {
    searchParams.set("state", state);
  }

  const querySuffix = searchParams.toString();
  const path = querySuffix ? `/api/patients?${querySuffix}` : "/api/patients";
  const payload = await requestJson(path, { method: "GET" }, "Unable to load clients.");

  return parseListPatientsResponse(payload).patients;
};

export const restoreClient = async (patientId: string): Promise<Patient> => {
  const payload = await requestJson(
    `/api/patients/${encodeURIComponent(patientId)}/restore`,
    { method: "POST" },
    "Unable to restore client.",
  );

  if (!isPatient(payload)) {
    throw new Error("Unexpected restore response format.");
  }

  return payload;
};

export const archiveClients = async (patientIds: string[]): Promise<string[]> => {
  const payload = await requestJson(
    "/api/patients/archive",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientIds }),
    },
    "Unable to archive clients.",
  );

  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { archivedIds?: unknown }).archivedIds)
  ) {
    throw new Error("Unexpected archive response format.");
  }

  return (payload as { archivedIds: string[] }).archivedIds;
};

export const createPatient = async (request: CreatePatientRequest): Promise<Patient> => {
  const payload = await requestJson(
    "/api/patients",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Unable to create client.",
  );

  if (!isPatient(payload)) {
    throw new Error("Unexpected client response format.");
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
    "Unable to update client.",
  );

  if (!isPatient(payload)) {
    throw new Error("Unexpected client response format.");
  }

  return payload;
};

export const deletePatient = async (patientId: string): Promise<DeletePatientResponse> => {
  const payload = await requestJson(
    `/api/patients/${encodeURIComponent(patientId)}`,
    {
      method: "DELETE",
    },
    "Unable to delete client.",
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
