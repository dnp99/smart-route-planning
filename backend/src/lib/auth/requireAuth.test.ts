import { afterEach, describe, expect, it, vi } from "vitest";

const { findValidSessionWithNurseMock } = vi.hoisted(() => ({
  findValidSessionWithNurseMock: vi.fn(),
}));

vi.mock("./sessionRepository", () => ({
  findValidSessionWithNurse: findValidSessionWithNurseMock,
}));

import { requireAuth } from "./requireAuth";

describe("requireAuth", () => {
  afterEach(() => {
    findValidSessionWithNurseMock.mockReset();
  });

  it("extracts auth context from session cookie", async () => {
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
      sessionId: "session-1",
    });
  });

  it("throws when session cookie is missing", async () => {
    const request = new Request("http://localhost:3000/api/patients");

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });

  it("throws when session cookie is invalid", async () => {
    findValidSessionWithNurseMock.mockResolvedValue(null);
    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        cookie: "careflow_session=session-invalid",
      },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });

  it("throws when session nurse is inactive", async () => {
    findValidSessionWithNurseMock.mockResolvedValue({
      sessionId: "session-1",
      nurseId: "nurse-1",
      email: "nurse@example.com",
      isActive: false,
    });

    const request = new Request("http://localhost:3000/api/patients", {
      headers: {
        cookie: "careflow_session=session-1",
      },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized.",
    });
  });
});
