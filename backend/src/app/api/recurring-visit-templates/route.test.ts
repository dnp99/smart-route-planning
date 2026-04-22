import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";

const {
  requireAuthMock,
  listRecurringVisitTemplatesByNurseMock,
  createRecurringVisitTemplateForNurseMock,
  validateCreateRecurringVisitTemplatePayloadMock,
  toRecurringVisitTemplateDtoMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  listRecurringVisitTemplatesByNurseMock: vi.fn(),
  createRecurringVisitTemplateForNurseMock: vi.fn(),
  validateCreateRecurringVisitTemplatePayloadMock: vi.fn(),
  toRecurringVisitTemplateDtoMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../lib/recurrence/recurrenceRepository", () => ({
  listRecurringVisitTemplatesByNurse: listRecurringVisitTemplatesByNurseMock,
  createRecurringVisitTemplateForNurse: createRecurringVisitTemplateForNurseMock,
}));

vi.mock("../../../lib/recurrence/recurrenceValidation", () => ({
  validateCreateRecurringVisitTemplatePayload: validateCreateRecurringVisitTemplatePayloadMock,
}));

vi.mock("../../../lib/recurrence/recurrenceDto", () => ({
  toRecurringVisitTemplateDto: toRecurringVisitTemplateDtoMock,
}));

vi.mock("../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { GET, OPTIONS, POST } from "./route";

describe("/api/recurring-visit-templates route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    listRecurringVisitTemplatesByNurseMock.mockReset();
    createRecurringVisitTemplateForNurseMock.mockReset();
    validateCreateRecurringVisitTemplatePayloadMock.mockReset();
    toRecurringVisitTemplateDtoMock.mockReset();
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
      new Request("http://localhost:3000/api/recurring-visit-templates", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
  });

  it("lists templates and forwards optional client filter", async () => {
    listRecurringVisitTemplatesByNurseMock.mockResolvedValue([{ id: "tpl-1" }]);
    toRecurringVisitTemplateDtoMock.mockReturnValue({ id: "tpl-1", name: "Mon AM" });

    const response = await GET(
      new Request("http://localhost:3000/api/recurring-visit-templates?patientId=client-1", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ templates: [{ id: "tpl-1", name: "Mon AM" }] });
    expect(listRecurringVisitTemplatesByNurseMock).toHaveBeenCalledWith("nurse-1", "client-1");
  });

  it("maps auth errors for GET", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await GET(
      new Request("http://localhost:3000/api/recurring-visit-templates", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing or invalid authorization token." });
  });

  it("returns 400 for invalid POST JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/recurring-visit-templates", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("creates template and returns 201", async () => {
    validateCreateRecurringVisitTemplatePayloadMock.mockReturnValue({ patientId: "client-1" });
    createRecurringVisitTemplateForNurseMock.mockResolvedValue({ id: "tpl-1", windows: [] });
    toRecurringVisitTemplateDtoMock.mockReturnValue({ id: "tpl-1", name: "Mon AM" });

    const response = await POST(
      new Request("http://localhost:3000/api/recurring-visit-templates", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ patientId: "client-1" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "tpl-1", name: "Mon AM" });
    expect(createRecurringVisitTemplateForNurseMock).toHaveBeenCalledWith("nurse-1", {
      patientId: "client-1",
    });
  });
});
