import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const {
  requireAuthMock,
  validateUpdateRecurringVisitTemplatePayloadMock,
  updateRecurringVisitTemplateForNurseMock,
  deleteRecurringVisitTemplateForNurseMock,
  toRecurringVisitTemplateDtoMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  validateUpdateRecurringVisitTemplatePayloadMock: vi.fn(),
  updateRecurringVisitTemplateForNurseMock: vi.fn(),
  deleteRecurringVisitTemplateForNurseMock: vi.fn(),
  toRecurringVisitTemplateDtoMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceValidation", () => ({
  validateUpdateRecurringVisitTemplatePayload: validateUpdateRecurringVisitTemplatePayloadMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceRepository", () => ({
  updateRecurringVisitTemplateForNurse: updateRecurringVisitTemplateForNurseMock,
  deleteRecurringVisitTemplateForNurse: deleteRecurringVisitTemplateForNurseMock,
}));

vi.mock("../../../../lib/recurrence/recurrenceDto", () => ({
  toRecurringVisitTemplateDto: toRecurringVisitTemplateDtoMock,
}));

vi.mock("../../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { DELETE, OPTIONS, PATCH } from "./route";

describe("/api/recurring-visit-templates/[id] route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    validateUpdateRecurringVisitTemplatePayloadMock.mockReset();
    updateRecurringVisitTemplateForNurseMock.mockReset();
    deleteRecurringVisitTemplateForNurseMock.mockReset();
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
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("PATCH, DELETE, OPTIONS");
  });

  it("returns 400 when template id is missing", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
      { params: { id: "   " } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Template id is required." });
  });

  it("maps invalid PATCH JSON to 400", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad",
      }),
      { params: { id: "tpl-1" } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("returns 404 when PATCH target is missing", async () => {
    validateUpdateRecurringVisitTemplatePayloadMock.mockReturnValue({ name: "New" });
    updateRecurringVisitTemplateForNurseMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
      { params: { id: "tpl-1" } },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Recurring visit template not found." });
  });

  it("updates template and returns dto", async () => {
    validateUpdateRecurringVisitTemplatePayloadMock.mockReturnValue({ name: "New" });
    updateRecurringVisitTemplateForNurseMock.mockResolvedValue({ id: "tpl-1" });
    toRecurringVisitTemplateDtoMock.mockReturnValue({ id: "tpl-1", name: "New" });

    const response = await PATCH(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "PATCH",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
      { params: { id: "tpl-1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "tpl-1", name: "New" });
  });

  it("deletes template and returns success payload", async () => {
    deleteRecurringVisitTemplateForNurseMock.mockResolvedValue({ id: "tpl-1" });

    const response = await DELETE(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "DELETE",
        headers: { origin: "http://localhost:5173" },
      }),
      { params: { id: "tpl-1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true, id: "tpl-1" });
  });

  it("maps auth errors for DELETE", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await DELETE(
      new Request("http://localhost:3000/api/recurring-visit-templates/tpl-1", {
        method: "DELETE",
        headers: { origin: "http://localhost:5173" },
      }),
      { params: { id: "tpl-1" } },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing or invalid authorization token." });
  });
});
