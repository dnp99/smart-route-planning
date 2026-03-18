import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, findNurseByIdMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findNurseByIdMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
}));

import { GET, OPTIONS } from "./route";

describe("/api/auth/me route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    delete process.env.AUTH_ENFORCE_HTTPS;
    requireAuthMock.mockReset();
    findNurseByIdMock.mockReset();
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
      new Request("http://localhost:3000/api/auth/me", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 426 for insecure transport when auth HTTPS enforcement is enabled", async () => {
    process.env.AUTH_ENFORCE_HTTPS = "true";

    const response = await GET(
      new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({
      error: "HTTPS is required for authentication endpoints.",
    });
  });

  it("returns 401 when authorization is invalid", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await GET(
      new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid authorization token.",
    });
  });

  it("returns 401 when nurse account no longer exists", async () => {
    findNurseByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns auth user for valid token", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
      },
    });
  });
});
