import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const {
  requireAuthMock,
  validateUpdateVisitInstancePayloadMock,
  updateVisitInstanceForNurseMock,
  toVisitInstanceDtoMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  validateUpdateVisitInstancePayloadMock: vi.fn(),
  updateVisitInstanceForNurseMock: vi.fn(),
  toVisitInstanceDtoMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceValidation", () => ({
  validateUpdateVisitInstancePayload: validateUpdateVisitInstancePayloadMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceRepository", () => ({
  updateVisitInstanceForNurse: updateVisitInstanceForNurseMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceDto", () => ({
  toVisitInstanceDto: toVisitInstanceDtoMock,
}));

vi.mock("../../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { OPTIONS, PATCH } from "./route";

describe("/api/visit-instances/[id] route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    validateUpdateVisitInstancePayloadMock.mockReset();
    updateVisitInstanceForNurseMock.mockReset();
    toVisitInstanceDtoMock.mockReset();
    logAuditEventMock.mockReset();
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
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("PATCH, OPTIONS");
  });

  it("maps invalid PATCH JSON to 400", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad",
      }),
      { params: { id: "inst-1" } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("returns 400 when visit instance id is missing", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: { id: "   " } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Visit instance id is required." });
  });

  it("returns 404 when PATCH target is missing", async () => {
    validateUpdateVisitInstancePayloadMock.mockReturnValue({ status: "cancelled" });
    updateVisitInstanceForNurseMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: { id: "inst-1" } },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Visit instance not found." });
  });

  it("updates visit instance and returns dto", async () => {
    validateUpdateVisitInstancePayloadMock.mockReturnValue({ status: "cancelled" });
    updateVisitInstanceForNurseMock.mockResolvedValue({ id: "inst-1" });
    toVisitInstanceDtoMock.mockReturnValue({ id: "inst-1", status: "cancelled" });

    const response = await PATCH(
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: { id: "inst-1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "inst-1", status: "cancelled" });
  });

  it("maps auth errors for PATCH", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await PATCH(
      new Request("http://localhost:3000/api/visit-instances/inst-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: { id: "inst-1" } },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing or invalid authorization token." });
  });
});
