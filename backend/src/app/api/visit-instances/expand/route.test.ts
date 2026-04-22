import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const {
  requireAuthMock,
  validateExpandVisitInstancesPayloadMock,
  expandVisitInstancesForNurseMock,
  toVisitInstanceDtoMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  validateExpandVisitInstancesPayloadMock: vi.fn(),
  expandVisitInstancesForNurseMock: vi.fn(),
  toVisitInstanceDtoMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceValidation", () => ({
  validateExpandVisitInstancesPayload: validateExpandVisitInstancesPayloadMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceRepository", () => ({
  expandVisitInstancesForNurse: expandVisitInstancesForNurseMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceDto", () => ({
  toVisitInstanceDto: toVisitInstanceDtoMock,
}));

vi.mock("../../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { OPTIONS, POST } from "./route";

describe("/api/visit-instances/expand route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    validateExpandVisitInstancesPayloadMock.mockReset();
    expandVisitInstancesForNurseMock.mockReset();
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
      new Request("http://localhost:3000/api/visit-instances/expand", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("maps invalid POST JSON to 400", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/visit-instances/expand", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("expands instances and returns payload", async () => {
    validateExpandVisitInstancesPayloadMock.mockReturnValue({ startDate: "2026-05-01", endDate: "2026-05-01" });
    expandVisitInstancesForNurseMock.mockResolvedValue({ createdCount: 1, instances: [{ id: "inst-1" }] });
    toVisitInstanceDtoMock.mockReturnValue({ id: "inst-1", status: "scheduled" });

    const response = await POST(
      new Request("http://localhost:3000/api/visit-instances/expand", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ planningDate: "2026-05-01" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      createdCount: 1,
      instances: [{ id: "inst-1", status: "scheduled" }],
    });
    expect(expandVisitInstancesForNurseMock).toHaveBeenCalledWith("nurse-1", {
      startDate: "2026-05-01",
      endDate: "2026-05-01",
    });
  });

  it("maps auth failures", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await POST(
      new Request("http://localhost:3000/api/visit-instances/expand", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ planningDate: "2026-05-01" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing or invalid authorization token." });
  });
});
