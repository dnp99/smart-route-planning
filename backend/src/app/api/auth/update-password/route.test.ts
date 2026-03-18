import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";

const {
  requireAuthMock,
  findNurseByIdMock,
  updateNursePasswordHashMock,
  verifyPasswordMock,
  hashPasswordMock,
  enforceUpdatePasswordRateLimitMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findNurseByIdMock: vi.fn(),
  updateNursePasswordHashMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  enforceUpdatePasswordRateLimitMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
  updateNursePasswordHash: updateNursePasswordHashMock,
}));

vi.mock("../../../../lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
  hashPassword: hashPasswordMock,
}));

vi.mock("../../../../lib/rateLimit/authUpdatePasswordRateLimit", () => ({
  enforceUpdatePasswordRateLimit: enforceUpdatePasswordRateLimitMock,
}));

import { OPTIONS, POST } from "./route";

const makeNurse = (overrides = {}) => ({
  id: "nurse-1",
  email: "nurse@example.com",
  displayName: "Nurse One",
  isActive: true,
  passwordHash: "hashed-current",
  ...overrides,
});

const makeRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/auth/update-password", {
    method: "POST",
    headers: {
      origin: "http://localhost:5173",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("/api/auth/update-password route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    delete process.env.AUTH_ENFORCE_HTTPS;
    requireAuthMock.mockReset();
    findNurseByIdMock.mockReset();
    updateNursePasswordHashMock.mockReset();
    verifyPasswordMock.mockReset();
    hashPasswordMock.mockReset();
    enforceUpdatePasswordRateLimitMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    enforceUpdatePasswordRateLimitMock.mockReturnValue(undefined);
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
      new Request("http://localhost:3000/api/auth/update-password", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 426 when HTTPS enforcement is enabled and request is not HTTPS", async () => {
    process.env.AUTH_ENFORCE_HTTPS = "true";

    const response = await POST(makeRequest({ currentPassword: "old", newPassword: "newpass123" }));

    expect(response.status).toBe(426);
  });

  it("returns 401 when authorization is invalid", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Missing or invalid authorization token."));

    const response = await POST(makeRequest({ currentPassword: "old", newPassword: "newpass123" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid authorization token.",
    });
  });

  it("returns 401 when nurse account no longer exists", async () => {
    findNurseByIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest({ currentPassword: "old", newPassword: "newpass123" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());
    enforceUpdatePasswordRateLimitMock.mockImplementation(() => {
      throw new HttpError(429, "Too many password update attempts. Please try again later.", {
        headers: { "Retry-After": "900" },
      });
    });

    const response = await POST(makeRequest({ currentPassword: "old", newPassword: "newpass123" }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many password update attempts. Please try again later.",
    });
  });

  it("returns 400 for invalid JSON body", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());

    const response = await POST(
      new Request("http://localhost:3000/api/auth/update-password", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("returns 400 when request body is missing required fields", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());

    const response = await POST(makeRequest({ currentPassword: "old" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request must include currentPassword and newPassword.",
    });
  });

  it("returns 400 when currentPassword is blank", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());

    const response = await POST(makeRequest({ currentPassword: "   ", newPassword: "newpass123" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Current password is required." });
  });

  it("returns 400 when newPassword is too short", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());

    const response = await POST(makeRequest({ currentPassword: "oldpass", newPassword: "short" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "New password must be at least 8 characters.",
    });
  });

  it("returns 400 when newPassword matches currentPassword", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());

    const response = await POST(
      makeRequest({ currentPassword: "samepass123", newPassword: "samepass123" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "New password must differ from current password.",
    });
  });

  it("returns 403 when currentPassword is incorrect", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(
      makeRequest({ currentPassword: "wrongpass", newPassword: "newpass123" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Current password is incorrect." });
  });

  it("updates password successfully and returns { success: true }", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());
    verifyPasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue("hashed-new");
    updateNursePasswordHashMock.mockResolvedValue(makeNurse({ passwordHash: "hashed-new" }));

    const response = await POST(
      makeRequest({ currentPassword: "currentpass", newPassword: "newpass123" }),
    );

    expect(response.status).toBe(200);
    expect(verifyPasswordMock).toHaveBeenCalledWith("currentpass", "hashed-current");
    expect(hashPasswordMock).toHaveBeenCalledWith("newpass123");
    expect(updateNursePasswordHashMock).toHaveBeenCalledWith("nurse-1", "hashed-new");
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns 401 when nurse disappears between auth and update", async () => {
    findNurseByIdMock.mockResolvedValue(makeNurse());
    verifyPasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue("hashed-new");
    updateNursePasswordHashMock.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ currentPassword: "currentpass", newPassword: "newpass123" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });
});
