import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, permanentlyDeleteMock, logAuditEventMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  permanentlyDeleteMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({ requireAuth: requireAuthMock }));
vi.mock("../../../../lib/patients/patientRepository", () => ({
  permanentlyDeletePatientsForNurse: permanentlyDeleteMock,
}));
vi.mock("../../../../lib/audit/auditLogger", () => ({ logAuditEvent: logAuditEventMock }));

import { OPTIONS, POST } from "./route";

const postRequest = (body?: unknown) =>
  new Request("http://localhost:3000/api/patients/permanent-delete", {
    method: "POST",
    headers: { origin: "http://localhost:5173", "content-type": "application/json" },
    body: body === undefined ? "not-json{" : JSON.stringify(body),
  });

describe("/api/patients/permanent-delete route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "n@example.com" });
    permanentlyDeleteMock.mockReset();
    permanentlyDeleteMock.mockResolvedValue(["p-1", "p-2"]);
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
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
      new Request("http://localhost:3000/api/patients/permanent-delete", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Unauthorized."));
    const response = await POST(postRequest({ patientIds: ["p-1"] }));
    expect(response.status).toBe(401);
    expect(permanentlyDeleteMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const response = await POST(postRequest(undefined));
    expect(response.status).toBe(400);
    expect(permanentlyDeleteMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or empty patientIds array", async () => {
    expect((await POST(postRequest({}))).status).toBe(400);
    expect((await POST(postRequest({ patientIds: [] }))).status).toBe(400);
    expect((await POST(postRequest({ patientIds: [123] }))).status).toBe(400);
    expect(permanentlyDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes and returns deletedIds for a valid request", async () => {
    const response = await POST(postRequest({ patientIds: ["p-1", "p-2", "p-1"] }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deletedIds).toEqual(["p-1", "p-2"]);
    // De-duped before hitting the repository.
    expect(permanentlyDeleteMock).toHaveBeenCalledWith("nurse-1", ["p-1", "p-2"]);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "patients.permanent_delete", outcome: "success" }),
    );
  });
});
