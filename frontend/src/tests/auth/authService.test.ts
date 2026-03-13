import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, signUp } from "../../components/auth/authService";

vi.mock("../../components/apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

describe("authService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in with email and password", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "jwt-token",
        user: {
          id: "nurse-1",
          email: "nurse@example.com",
          displayName: "Nurse One",
        },
      }),
    } as Response);

    const result = await login("nurse@example.com", "secret123");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "nurse@example.com",
        password: "secret123",
      }),
    });
    expect(result.token).toBe("jwt-token");
  });

  it("signs up with display name, email, and password", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "jwt-token",
        user: {
          id: "nurse-2",
          email: "nurse@example.com",
          displayName: "Nurse Two",
        },
      }),
    } as Response);

    const result = await signUp("Nurse Two", "nurse@example.com", "secret123");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: "Nurse Two",
        email: "nurse@example.com",
        password: "secret123",
      }),
    });
    expect(result.user.displayName).toBe("Nurse Two");
  });
});
