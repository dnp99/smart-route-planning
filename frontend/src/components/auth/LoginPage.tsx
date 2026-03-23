import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
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
    <main className={responsiveStyles.authViewport}>
      <section className={responsiveStyles.authCard}>
        <div className={responsiveStyles.authSegmentedControl}>
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={[
              responsiveStyles.authSegmentedButton,
              mode === "login"
                ? responsiveStyles.authSegmentedButtonActive
                : responsiveStyles.authSegmentedButtonInactive,
            ].join(" ")}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={[
              responsiveStyles.authSegmentedButton,
              mode === "signup"
                ? responsiveStyles.authSegmentedButtonActive
                : responsiveStyles.authSegmentedButtonInactive,
            ].join(" ")}
          >
            Sign up
          </button>
        </div>

        <h1 className={responsiveStyles.authHeading}>
          {mode === "signup" ? "Create account" : "Login"}
        </h1>

        <p className={responsiveStyles.authDescription}>
          {mode === "signup"
            ? "Create your CareFlow account to manage patients and route-planning data."
            : "Sign in to continue managing patients and route-planning data."}
        </p>

        <form className={responsiveStyles.authForm} onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className={responsiveStyles.authLabel}>
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
                className={responsiveStyles.authInput}
                required
              />
            </label>
          )}

          <label className={responsiveStyles.authLabel}>
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
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <label className={responsiveStyles.authLabel}>
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
              className={responsiveStyles.authInput}
              required
            />
            {mode === "signup" && (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                Use at least 8 characters for your account password.
              </span>
            )}
          </label>

          {mode === "signup" && (
            <label className={responsiveStyles.authLabel}>
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
                className={responsiveStyles.authInput}
                required
              />
            </label>
          )}

          {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className={responsiveStyles.authPrimaryButton}
          >
            {isSubmitting
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>

          <div className={responsiveStyles.authHelperRow}>
            {mode === "login" ? (
              <>
                <a href="mailto:dpatel1995@yahoo.com" className={responsiveStyles.authHelperLink}>
                  Forgot password?
                </a>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={responsiveStyles.authHelperButton}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={responsiveStyles.authHelperButton}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
