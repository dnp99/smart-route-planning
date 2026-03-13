import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../../components/auth/LoginPage";

const { loginMock, signUpMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock("../../components/auth/authService", () => ({
  login: loginMock,
  signUp: signUpMock,
  fetchMe: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
    signUpMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("submits sign-up details and stores auth session", async () => {
    signUpMock.mockResolvedValue({
      token: "jwt-token",
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/route-planner" element={<div>Route Planner</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Nurse One" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith("Nurse One", "nurse@example.com", "secret123");
    });

    expect(await screen.findByText("Route Planner")).toBeTruthy();
    expect(window.localStorage.getItem("careflow.auth.token")).toBe("jwt-token");
  });
});
