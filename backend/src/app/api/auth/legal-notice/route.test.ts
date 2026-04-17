import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, findNurseByIdMock, acknowledgeNurseLegalNoticeMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findNurseByIdMock: vi.fn(),
  acknowledgeNurseLegalNoticeMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
  acknowledgeNurseLegalNotice: acknowledgeNurseLegalNoticeMock,
}));

import { GET, OPTIONS, POST } from "./route";

describe("/api/auth/legal-notice route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    delete process.env.AUTH_ENFORCE_HTTPS;
    requireAuthMock.mockReset();
    findNurseByIdMock.mockReset();
    acknowledgeNurseLegalNoticeMock.mockReset();
    requireAuthMock.mockResolvedValue({
      nurseId: "nurse-1",
      email: "nurse@example.com",
    });
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }

    if (originalAuthEnforceHttps === undefined) {
      delete process.env.AUTH_ENFORCE_HTTPS;
    } else {
      process.env.AUTH_ENFORCE_HTTPS = originalAuthEnforceHttps;
    }
  });

  it("handles OPTIONS preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/auth/legal-notice", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
  });

  it("returns required=true when never acknowledged", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      isActive: true,
      legalNoticeAcceptedVersion: null,
      legalNoticeAcceptedAt: null,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/auth/legal-notice", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      required: true,
      currentVersion: "2026-04-16",
      acceptedVersion: null,
      acceptedAt: null,
    });
  });

  it("returns 401 when auth is invalid", async () => {
    requireAuthMock.mockRejectedValue(
      new HttpError(401, "Missing or invalid authorization token."),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/auth/legal-notice", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("acknowledges legal notice on POST", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      isActive: true,
      legalNoticeAcceptedVersion: null,
      legalNoticeAcceptedAt: null,
    });
    acknowledgeNurseLegalNoticeMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      isActive: true,
      legalNoticeAcceptedVersion: "2026-04-16",
      legalNoticeAcceptedAt: new Date("2026-04-16T10:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost:3000/api/auth/legal-notice", {
        method: "POST",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({ agree: true }),
      }),
    );

    expect(acknowledgeNurseLegalNoticeMock).toHaveBeenCalledWith("nurse-1", "2026-04-16");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      required: false,
      currentVersion: "2026-04-16",
      acceptedVersion: "2026-04-16",
      acceptedAt: "2026-04-16T10:00:00.000Z",
    });
  });
});
