import { afterEach, describe, expect, it, vi } from "vitest";

const { findNurseByIdMock } = vi.hoisted(() => ({
  findNurseByIdMock: vi.fn(),
}));
const { findValidSessionWithNurseMock } = vi.hoisted(() => ({
  findValidSessionWithNurseMock: vi.fn(),
}));

vi.mock("../patients/patientRepository", () => ({
  findNurseById: findNurseByIdMock,
}));
vi.mock("./sessionRepository", () => ({
  findValidSessionWithNurse: findValidSessionWithNurseMock,
}));

import { requireAuth } from "./requireAuth";
import { signAccessToken } from "./jwt";

describe("requireAuth", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    findNurseByIdMock.mockReset();
    findValidSessionWithNurseMock.mockReset();

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it("extracts auth context from bearer token", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      isActive: true,
    });

    const token = await signAccessToken({
      nurseId: "nurse-1",
      email: "nurse@example.com",
    });

    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    await expect(requireAuth(request)).resolves.toEqual({
      nurseId: "nurse-1",
      email: "nurse@example.com",
      authMethod: "bearer_token",
    });
  });

  it("extracts auth context from session cookie", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    findValidSessionWithNurseMock.mockResolvedValue({
      sessionId: "session-1",
      nurseId: "nurse-1",
      email: "nurse@example.com",
      isActive: true,
    });

    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        cookie: "careflow_session=session-1",
      },
    });

    await expect(requireAuth(request)).resolves.toEqual({
      nurseId: "nurse-1",
      email: "nurse@example.com",
      authMethod: "session_cookie",
      sessionId: "session-1",
    });
  });

  it("throws when authorization header is missing", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    const request = new Request("http://localhost:3000/api/patients");

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Missing or invalid authorization token.",
    });
  });

  it("throws when authorization scheme is invalid", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        authorization: "Token abc",
      },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Missing or invalid authorization token.",
    });
  });

  it("throws when token nurse is inactive", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    findNurseByIdMock.mockResolvedValue({
      id: "nurse-1",
      email: "nurse@example.com",
      isActive: false,
    });

    const token = await signAccessToken({
      nurseId: "nurse-1",
      email: "nurse@example.com",
    });

    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });
});
