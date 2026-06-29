import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, countPatientsByStateForNurseMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  countPatientsByStateForNurseMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  countPatientsByStateForNurse: countPatientsByStateForNurseMock,
}));

import { GET, OPTIONS } from "./route";

describe("/api/patients/counts route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    countPatientsByStateForNurseMock.mockReset();
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
      new Request("http://localhost:3000/api/patients/counts", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("returns per-state counts for the authenticated nurse", async () => {
    countPatientsByStateForNurseMock.mockResolvedValue({ active: 5, idle: 3, archived: 2 });

    const response = await GET(
      new Request("http://localhost:3000/api/patients/counts", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ active: 5, idle: 3, archived: 2 });
    expect(countPatientsByStateForNurseMock).toHaveBeenCalledWith("nurse-1");
  });

  it("propagates auth failures", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Unauthorized"));

    const response = await GET(
      new Request("http://localhost:3000/api/patients/counts", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    expect(countPatientsByStateForNurseMock).not.toHaveBeenCalled();
  });
});
