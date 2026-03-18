import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLoginRateLimitForTests } from "../requestGuards";

const {
  findNurseByEmailMock,
  updateNurseLastLoginAtMock,
  verifyPasswordMock,
  signAccessTokenMock,
} = vi.hoisted(() => ({
  findNurseByEmailMock: vi.fn(),
  updateNurseLastLoginAtMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  signAccessTokenMock: vi.fn(),
}));

vi.mock("../../../../lib/patients/patientRepository", () => ({
  findNurseByEmail: findNurseByEmailMock,
  updateNurseLastLoginAt: updateNurseLastLoginAtMock,
}));

vi.mock("../../../../lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

vi.mock("../../../../lib/auth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
}));

import { OPTIONS, POST } from "./route";

describe("/api/auth/login route", () => {
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
    updateNurseLastLoginAtMock.mockReset();
    verifyPasswordMock.mockReset();
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
      new Request("http://localhost:3000/api/auth/login", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects OPTIONS preflight for disallowed origins", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/auth/login", {
        method: "OPTIONS",
        headers: { origin: "http://malicious.example.com" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin is not allowed." });
  });

  it("returns 426 for insecure transport when auth HTTPS enforcement is enabled", async () => {
    process.env.AUTH_ENFORCE_HTTPS = "true";

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({
      error: "HTTPS is required for authentication endpoints.",
    });
  });

  it("returns 400 for invalid json body", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("returns 400 for malformed payload", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Login payload must include email and password.",
    });
  });

  it("returns 400 when login payload has blank email or password", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "  ", password: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Login payload must include email and password.",
    });
  });

  it("returns 401 when nurse account is missing", async () => {
    findNurseByEmailMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid email or password." });
  });

  it("returns 401 when account is inactive", async () => {
    findNurseByEmailMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse",
      passwordHash: "hash",
      isActive: false,
    });

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid email or password." });
  });

  it("returns 401 when password does not match", async () => {
    findNurseByEmailMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse",
      passwordHash: "hash",
      isActive: true,
    });
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid email or password." });
  });

  it("returns token and auth user on successful login", async () => {
    findNurseByEmailMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      passwordHash: "hash",
      isActive: true,
    });
    verifyPasswordMock.mockResolvedValue(true);
    signAccessTokenMock.mockResolvedValue("jwt-token");

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "jwt-token",
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: null,
      },
    });
    expect(updateNurseLastLoginAtMock).toHaveBeenCalledWith("nurse-1");
  });

  it("returns 500 when token signing fails unexpectedly", async () => {
    findNurseByEmailMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
      passwordHash: "hash",
      isActive: true,
    });
    verifyPasswordMock.mockResolvedValue(true);
    signAccessTokenMock.mockRejectedValue(new Error("signing failure"));

    const response = await POST(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to login.",
    });
  });

  it("returns 429 when login rate limit is exceeded", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = "1";
    findNurseByEmailMock.mockResolvedValue(null);

    const buildRequest = () =>
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({ email: "nurse@example.com", password: "secret" }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toEqual({
      error: "Too many login attempts. Please try again shortly.",
    });
  });
});
