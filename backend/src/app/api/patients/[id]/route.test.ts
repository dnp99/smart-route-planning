import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const {
  requireAuthMock,
  validateUpdatePatientPayloadMock,
  updatePatientForNurseMock,
  deletePatientForNurseMock,
  toPatientDtoMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  validateUpdatePatientPayloadMock: vi.fn(),
  updatePatientForNurseMock: vi.fn(),
  deletePatientForNurseMock: vi.fn(),
  toPatientDtoMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientValidation", () => ({
  validateUpdatePatientPayload: validateUpdatePatientPayloadMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  updatePatientForNurse: updatePatientForNurseMock,
  deletePatientForNurse: deletePatientForNurseMock,
}));

vi.mock("../../../../lib/patients/patientDto", () => ({
  toPatientDto: toPatientDtoMock,
}));

import { DELETE, OPTIONS, PATCH } from "./route";

describe("/api/patients/[id] route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    validateUpdatePatientPayloadMock.mockReset();
    updatePatientForNurseMock.mockReset();
    deletePatientForNurseMock.mockReset();
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
      new Request("http://localhost:3000/api/patients/p1", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("PATCH, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
  });

  it("returns 401 when authorization is missing or invalid", async () => {
    requireAuthMock.mockRejectedValue(
      new HttpError(401, "Missing or invalid authorization token."),
    );

    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid authorization token.",
    });
  });

  it("returns OPTIONS error response for disallowed origin", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "OPTIONS",
        headers: { origin: "http://evil.example.com" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin is not allowed." });
  });

  it("maps invalid PATCH JSON to 400", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad",
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("returns 400 when patient id is missing", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
      { params: { id: "   " } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Patient id is required." });
  });

  it("returns 404 when PATCH target is missing", async () => {
    validateUpdatePatientPayloadMock.mockReturnValue({ firstName: "Jane" });
    updatePatientForNurseMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Patient not found." });
  });

  it("updates patient and returns dto", async () => {
    validateUpdatePatientPayloadMock.mockReturnValue({ firstName: "Jane" });
    updatePatientForNurseMock.mockResolvedValue({ id: "p1" });
    toPatientDtoMock.mockReturnValue({ id: "p1", firstName: "Jane" });

    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "p1", firstName: "Jane" });
  });

  it("maps PATCH errors through toErrorResponse", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(500, "config"));

    const response = await PATCH(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "config" });
  });

  it("returns 404 when DELETE target is missing", async () => {
    deletePatientForNurseMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "DELETE",
        headers: { origin: "http://localhost:5173" },
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Patient not found." });
  });

  it("deletes patient and returns success payload", async () => {
    deletePatientForNurseMock.mockResolvedValue({ id: "p1" });

    const response = await DELETE(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "DELETE",
        headers: { origin: "http://localhost:5173" },
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true, id: "p1" });
  });

  it("maps unknown DELETE errors to fallback message", async () => {
    requireAuthMock.mockImplementation(() => {
      throw new Error("unexpected");
    });

    const response = await DELETE(
      new Request("http://localhost:3000/api/patients/p1", {
        method: "DELETE",
        headers: { origin: "http://localhost:5173" },
      }),
      { params: { id: "p1" } },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to delete patient." });
  });
});
