import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signUp } from "./authService";
import { setAuthSession } from "./authSession";

type AuthMode = "login" | "signup";

const LoginPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFormFeedback = () => {
    setError("");
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetFormFeedback();
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    resetFormFeedback();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedDisplayName = displayName.trim();

    if (mode === "signup" && !trimmedDisplayName) {
      setError("Display name, email, password, and confirmation are required.");
      return;
    }

    if (!trimmedEmail || !password || (mode === "signup" && !confirmPassword)) {
      setError(
        mode === "signup"
          ? "Display name, email, password, and confirmation are required."
          : "Email and password are required.",
      );
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        mode === "signup"
          ? await signUp(trimmedDisplayName, trimmedEmail, password)
          : await login(trimmedEmail, password);
      setAuthSession(result.token, result.user);
      navigate("/patients", { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : mode === "signup"
            ? "Unable to sign up."
            : "Unable to login.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 grid gap-3">
        <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
              mode === "login"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            ].join(" ")}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
              mode === "signup"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            ].join(" ")}
          >
            Sign up
          </button>
        </div>

        <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {mode === "signup" ? "Create account" : "Login"}
        </h1>
      </div>
      <p className="mb-5 mt-2 text-sm text-slate-600 dark:text-slate-300">
        {mode === "signup"
          ? "Create your CareFlow account to manage patients and route-planning data."
          : "Sign in to continue managing patients and route-planning data."}
      </p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="grid gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <span>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (error) {
                  resetFormFeedback();
                }
              }}
              autoComplete="name"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              required
            />
          </label>
        )}

        <label className="grid gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) {
                resetFormFeedback();
              }
            }}
            autoComplete="email"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) {
                resetFormFeedback();
              }
            }}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            required
          />
          {mode === "signup" && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Use at least 8 characters for your account password.
            </span>
          )}
        </label>

        {mode === "signup" && (
          <label className="grid gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) {
                  resetFormFeedback();
                }
              }}
              autoComplete="new-password"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              required
            />
          </label>
        )}

        {error && (
          <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting
            ? mode === "signup"
              ? "Creating account..."
              : "Signing in..."
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
    </main>
  );
};

export default LoginPage;
