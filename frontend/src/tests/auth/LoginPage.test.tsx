import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  updateProfileHomeAddress: vi.fn(),
}));

describe("LoginPage", () => {
  const getPasswordInputs = () => screen.getAllByLabelText(/password/i) as HTMLInputElement[];

  beforeEach(() => {
    loginMock.mockReset();
    signUpMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("submits sign-up details and stores auth session", async () => {
    signUpMock.mockResolvedValue({
      token: "jwt-token",
      user: {
        id: "nurse-1",
        email: "nurse@example.com",
        displayName: "Nurse One",
        homeAddress: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/patients" element={<div>Patients</div>} />
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
    fireEvent.change(getPasswordInputs()[0], {
      target: { value: "secret123" },
    });
    fireEvent.change(getPasswordInputs()[1], {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith("Nurse One", "nurse@example.com", "secret123");
    });

    expect(await screen.findByText("Patients")).toBeTruthy();
    expect(window.localStorage.getItem("careflow.auth.token")).toBe("jwt-token");
  });

  it("shows signup-specific copy and blocks submission when passwords do not match", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/patients" element={<div>Patients</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      screen.getByText("Create your CareFlow account to manage patients and route-planning data."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Nurse One" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(getPasswordInputs()[0], {
      target: { value: "secret123" },
    });
    fireEvent.change(getPasswordInputs()[1], {
      target: { value: "secret456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(signUpMock).not.toHaveBeenCalled();
  });
});
