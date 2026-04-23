import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http";

const {
  requireAuthMock,
  listVisitInstancesByNurseInRangeMock,
  validateVisitInstancesPlanningDateMock,
  toVisitInstanceDtoMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  listVisitInstancesByNurseInRangeMock: vi.fn(),
  validateVisitInstancesPlanningDateMock: vi.fn(),
  toVisitInstanceDtoMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../lib/recurrence/recurrenceRepository", () => ({
  listVisitInstancesByNurseInRange: listVisitInstancesByNurseInRangeMock,
}));

vi.mock("../../../lib/recurrence/recurrenceValidation", () => ({
  validateVisitInstancesPlanningDate: validateVisitInstancesPlanningDateMock,
}));

vi.mock("../../../lib/recurrence/recurrenceDto", () => ({
  toVisitInstanceDto: toVisitInstanceDtoMock,
}));

vi.mock("../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { GET, OPTIONS } from "./route";

describe("/api/visit-instances route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    listVisitInstancesByNurseInRangeMock.mockReset();
    validateVisitInstancesPlanningDateMock.mockReset();
    validateVisitInstancesPlanningDateMock.mockReturnValue("2026-05-01");
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
      new Request("http://localhost:3000/api/visit-instances", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("returns 401 when authorization fails", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await GET(
      new Request("http://localhost:3000/api/visit-instances?planningDate=2026-05-01", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing or invalid authorization token." });
  });

  it("passes planningDate and endDate filters to repository", async () => {
    listVisitInstancesByNurseInRangeMock.mockResolvedValue([{ id: "inst-1" }]);
    toVisitInstanceDtoMock.mockReturnValue({ id: "inst-1", status: "scheduled" });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/visit-instances?planningDate=2026-05-01&endDate=2026-05-03",
        {
          method: "GET",
          headers: { origin: "http://localhost:5173" },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      instances: [{ id: "inst-1", status: "scheduled" }],
    });
    expect(validateVisitInstancesPlanningDateMock).toHaveBeenCalledWith("2026-05-01");
    expect(listVisitInstancesByNurseInRangeMock).toHaveBeenCalledWith(
      "nurse-1",
      "2026-05-01",
      "2026-05-03",
    );
  });

  it("defaults endDate to planningDate when omitted", async () => {
    listVisitInstancesByNurseInRangeMock.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost:3000/api/visit-instances?planningDate=2026-05-01", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ instances: [] });
    expect(listVisitInstancesByNurseInRangeMock).toHaveBeenCalledWith(
      "nurse-1",
      "2026-05-01",
      "2026-05-01",
    );
  });
});
