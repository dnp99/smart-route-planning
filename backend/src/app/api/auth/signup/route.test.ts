import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLoginRateLimitForTests } from "../requestGuards";

const {
  findNurseByEmailMock,
  createNurseAccountMock,
  updateNurseLastLoginAtMock,
  hashPasswordMock,
  signAccessTokenMock,
  NurseEmailConflictErrorMock,
} = vi.hoisted(() => ({
  findNurseByEmailMock: vi.fn(),
  createNurseAccountMock: vi.fn(),
  updateNurseLastLoginAtMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  signAccessTokenMock: vi.fn(),
  NurseEmailConflictErrorMock: class NurseEmailConflictError extends Error {},
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseByEmail: findNurseByEmailMock,
  createNurseAccount: createNurseAccountMock,
  NurseEmailConflictError: NurseEmailConflictErrorMock,
  updateNurseLastLoginAt: updateNurseLastLoginAtMock,
}));

vi.mock("../../../../lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("../../../../lib/auth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
}));

import { OPTIONS, POST } from "./route";

describe("/api/auth/signup route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalRateLimitWindow = process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const originalRateLimitMax = process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
  const originalAuthEnforceHttps = process.env.AUTH_ENFORCE_HTTPS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "5";
    delete process.env.AUTH_ENFORCE_HTTPS;
    __resetLoginRateLimitForTests();
    findNurseByEmailMock.mockReset();
    createNurseAccountMock.mockReset();
    updateNurseLastLoginAtMock.mockReset();
    hashPasswordMock.mockReset();
    signAccessTokenMock.mockReset();
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }

    if (originalRateLimitWindow === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = originalRateLimitWindow;
    }

    if (originalRateLimitMax === undefined) {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = originalRateLimitMax;
    }

    if (originalAuthEnforceHttps === undefined) {
      delete process.env.AUTH_ENFORCE_HTTPS;
    } else {
      process.env.AUTH_ENFORCE_HTTPS = originalAuthEnforceHttps;
    }
  });

  it("handles OPTIONS preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 426 for insecure transport when auth HTTPS enforcement is enabled", async () => {
    process.env.AUTH_ENFORCE_HTTPS = "true";

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Nurse One",
          email: "nurse@example.com",
          password: "secret123",
        }),
      }),
    );

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({
      error: "HTTPS is required for authentication endpoints.",
    });
  });

  it("returns 400 for malformed payload", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret123" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Signup payload must include displayName, email, and password.",
    });
  });

  it("returns 400 for short password", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Nurse One",
          email: "nurse@example.com",
          password: "short",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Password must be at least 8 characters.",
    });
  });

  it("returns 409 when email is already in use", async () => {
    findNurseByEmailMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Nurse One",
          email: "nurse@example.com",
          password: "secret123",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An account with this email already exists.",
    });
  });

  it("returns 409 when account creation loses a signup race on the unique email constraint", async () => {
    findNurseByEmailMock.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue("hashed-password");
    createNurseAccountMock.mockRejectedValue(
      new NurseEmailConflictErrorMock("An account with this email already exists."),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Nurse One",
          email: "nurse@example.com",
          password: "secret123",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An account with this email already exists.",
    });
    expect(updateNurseLastLoginAtMock).not.toHaveBeenCalled();
    expect(signAccessTokenMock).not.toHaveBeenCalled();
  });

  it("creates account and returns token on successful signup", async () => {
    findNurseByEmailMock.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue("hashed-password");
    createNurseAccountMock.mockResolvedValue({
      id: "nurse-2",
      email: "nurse@example.com",
      displayName: "Nurse One",
    });
    signAccessTokenMock.mockResolvedValue("jwt-token");

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Nurse One",
          email: "Nurse@example.com",
          password: "secret123",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(hashPasswordMock).toHaveBeenCalledWith("secret123");
    expect(createNurseAccountMock).toHaveBeenCalledWith({
      displayName: "Nurse One",
      email: "nurse@example.com",
      passwordHash: "hashed-password",
    });
    await expect(response.json()).resolves.toEqual({
      token: "jwt-token",
      user: {
        id: "nurse-2",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: null,
      },
    });
    expect(updateNurseLastLoginAtMock).toHaveBeenCalledWith("nurse-2");
  });
});
