import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMe,
  login,
  signUp,
  updateProfile,
  updateProfileHomeAddress,
} from "../../components/auth/authService";

vi.mock("../../components/shared/apiBaseUrl", () => ({
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
        user: {
          id: "nurse-1",
          email: "nurse@example.com",
          displayName: "Nurse One",
          homeAddress: null,
        },
      }),
    } as Response);

    const result = await login("nurse@example.com", "secret123");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "nurse@example.com",
        password: "secret123",
      }),
    });
    expect(result.user.displayName).toBe("Nurse One");
  });

  it("signs up with display name, email, and password", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "nurse-2",
          email: "nurse@example.com",
          displayName: "Nurse Two",
          homeAddress: null,
        },
      }),
    } as Response);

    const result = await signUp("Nurse Two", "nurse@example.com", "secret123");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/signup", {
      method: "POST",
      credentials: "include",
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

  it("loads current authenticated user profile", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "nurse-1",
          email: "nurse@example.com",
          displayName: "Nurse One",
          homeAddress: "3361 Ingram Road, Mississauga, ON",
        },
      }),
    } as Response);

    const result = await fetchMe();

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/me", {
      method: "GET",
      credentials: "include",
    });
    expect(result.user.homeAddress).toBe("3361 Ingram Road, Mississauga, ON");
  });

  it("updates profile home address", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "nurse-1",
          email: "nurse@example.com",
          displayName: "Nurse One",
          homeAddress: "1 Main Street, Toronto, ON",
        },
      }),
    } as Response);

    const result = await updateProfileHomeAddress("1 Main Street, Toronto, ON");

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/me", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        homeAddress: "1 Main Street, Toronto, ON",
      }),
    });
    expect(result.user.homeAddress).toBe("1 Main Street, Toronto, ON");
  });

  it("updates profile display name", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "nurse-1",
          email: "nurse@example.com",
          displayName: "Alex Brown",
          homeAddress: "1 Main Street, Toronto, ON",
        },
      }),
    } as Response);

    const result = await updateProfile({ displayName: "Alex Brown" });

    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/api/auth/me", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: "Alex Brown",
      }),
    });
    expect(result.user.displayName).toBe("Alex Brown");
  });
});
