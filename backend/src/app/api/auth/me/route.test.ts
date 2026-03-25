import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const { requireAuthMock, findNurseByIdMock, updateNurseHomeAddressMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findNurseByIdMock: vi.fn(),
  updateNurseHomeAddressMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
  updateNurseHomeAddress: updateNurseHomeAddressMock,
}));

import { GET, OPTIONS, PATCH } from "./route";

describe("/api/auth/me route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    delete process.env.AUTH_ENFORCE_HTTPS;
    requireAuthMock.mockReset();
    findNurseByIdMock.mockReset();
    updateNurseHomeAddressMock.mockReset();
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
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, PATCH, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects OPTIONS preflight for disallowed origins", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/auth/me", {
        method: "OPTIONS",
        headers: { origin: "http://malicious.example.com" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin is not allowed." });
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
    requireAuthMock.mockRejectedValue(
      new HttpError(401, "Missing or invalid authorization token."),
    );

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
        homeAddress: null,
        workingHours: null,
        breakGapThresholdMinutes: null,
        optimizationObjective: null,
      },
    });
  });

  it("updates nurse home address for an authenticated nurse", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });
    updateNurseHomeAddressMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: "1 Main Street, Toronto, ON",
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          homeAddress: " 1 Main Street, Toronto, ON ",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateNurseHomeAddressMock).toHaveBeenCalledWith(
      "nurse-1",
      "1 Main Street, Toronto, ON",
    );
    await expect(response.json()).resolves.toEqual({
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: "1 Main Street, Toronto, ON",
        workingHours: null,
        breakGapThresholdMinutes: null,
        optimizationObjective: null,
      },
    });
  });

  it("returns 400 for invalid PATCH json body", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
    });
  });

  it("returns 400 when homeAddress is missing", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Profile payload must include at least one field to update.",
    });
  });

  it("returns 400 when homeAddress is blank", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({ homeAddress: " " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Home address is required.",
    });
  });

  it("returns 400 when homeAddress exceeds max length", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({ homeAddress: "A".repeat(201) }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Home address must be 200 characters or fewer.",
    });
  });

  it("returns 401 when PATCH is called for an inactive/missing nurse", async () => {
    findNurseByIdMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({ homeAddress: "1 Main Street, Toronto, ON" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 401 when home-address update target no longer exists", async () => {
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      isActive: true,
      homeAddress: null,
    });
    updateNurseHomeAddressMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({ homeAddress: "1 Main Street, Toronto, ON" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });
});
