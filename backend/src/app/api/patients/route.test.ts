import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";

const {
  resolveNurseContextMock,
  listPatientsByNurseMock,
  createPatientForNurseMock,
  validateCreatePatientPayloadMock,
  toPatientDtoMock,
} = vi.hoisted(() => ({
  resolveNurseContextMock: vi.fn(),
  listPatientsByNurseMock: vi.fn(),
  createPatientForNurseMock: vi.fn(),
  validateCreatePatientPayloadMock: vi.fn(),
  toPatientDtoMock: vi.fn(),
}));

vi.mock("../../../lib/patients/nurseContext", () => ({
  resolveNurseContext: resolveNurseContextMock,
}));

vi.mock("../../../lib/patients/patientRepository", () => ({
  listPatientsByNurse: listPatientsByNurseMock,
  createPatientForNurse: createPatientForNurseMock,
}));

vi.mock("../../../lib/patients/patientValidation", () => ({
  validateCreatePatientPayload: validateCreatePatientPayloadMock,
}));

vi.mock("../../../lib/patients/patientDto", () => ({
  toPatientDto: toPatientDtoMock,
}));

import { GET, OPTIONS, POST } from "./route";

describe("/api/patients route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    resolveNurseContextMock.mockReset();
    listPatientsByNurseMock.mockReset();
    createPatientForNurseMock.mockReset();
    validateCreatePatientPayloadMock.mockReset();
    toPatientDtoMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("handles OPTIONS preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/patients", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
  });

  it("returns OPTIONS error response when origin is disallowed", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/patients", {
        method: "OPTIONS",
        headers: { origin: "http://evil.example.com" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin is not allowed." });
  });

  it("lists patients with optional search query", async () => {
    resolveNurseContextMock.mockResolvedValue({ nurseId: "nurse-1" });
    listPatientsByNurseMock.mockResolvedValue([{ id: "patient-1" }]);
    toPatientDtoMock.mockReturnValue({ id: "patient-1", firstName: "Jane" });

    const response = await GET(
      new Request("http://localhost:3000/api/patients?query=Jane", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      patients: [{ id: "patient-1", firstName: "Jane" }],
    });
    expect(listPatientsByNurseMock).toHaveBeenCalledWith("nurse-1", "Jane");
  });

  it("maps GET errors via toErrorResponse", async () => {
    resolveNurseContextMock.mockRejectedValue(new HttpError(500, "boom"));

    const response = await GET(
      new Request("http://localhost:3000/api/patients", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });

  it("lists patients when query parameter is omitted", async () => {
    resolveNurseContextMock.mockResolvedValue({ nurseId: "nurse-1" });
    listPatientsByNurseMock.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost:3000/api/patients", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ patients: [] });
    expect(listPatientsByNurseMock).toHaveBeenCalledWith("nurse-1", "");
  });

  it("maps invalid POST body JSON to 400", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/patients", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("creates patient and returns 201", async () => {
    resolveNurseContextMock.mockResolvedValue({ nurseId: "nurse-1" });
    validateCreatePatientPayloadMock.mockReturnValue({ firstName: "Jane" });
    createPatientForNurseMock.mockResolvedValue({ id: "patient-1" });
    toPatientDtoMock.mockReturnValue({ id: "patient-1", firstName: "Jane" });

    const response = await POST(
      new Request("http://localhost:3000/api/patients", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "patient-1", firstName: "Jane" });
    expect(createPatientForNurseMock).toHaveBeenCalledWith("nurse-1", { firstName: "Jane" });
  });

  it("maps unknown POST errors to fallback message", async () => {
    resolveNurseContextMock.mockResolvedValue({ nurseId: "nurse-1" });
    validateCreatePatientPayloadMock.mockImplementation(() => {
      throw new Error("unexpected");
    });

    const response = await POST(
      new Request("http://localhost:3000/api/patients", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to create patient." });
  });
});
