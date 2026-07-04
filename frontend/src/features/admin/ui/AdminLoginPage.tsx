import { useState } from "react";
import { responsiveStyles } from "../../../components/responsiveStyles";

type AdminLoginPageProps = {
  onSignIn: (email: string, password: string) => void;
  isSigningIn: boolean;
  error: string;
};

const AdminLoginPage = ({ onSignIn, isSigningIn, error }: AdminLoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSignIn(email.trim().toLowerCase(), password);
  };

  return (
    <main className={responsiveStyles.authViewport}>
      <section className={responsiveStyles.authCard}>
        <p className={responsiveStyles.adminEyebrow}>Routefy Admin</p>
        <h1 className={responsiveStyles.authHeading}>Admin sign in</h1>
        <p className={responsiveStyles.authDescription}>
          Restricted area. Sign in with your admin credentials.
        </p>

        {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}

        <form className={responsiveStyles.authForm} onSubmit={handleSubmit}>
          <label className={responsiveStyles.authLabel}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <label className={responsiveStyles.authLabel}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <button
            type="submit"
            className={responsiveStyles.authPrimaryButton}
            disabled={isSigningIn}
          >
            {isSigningIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default AdminLoginPage;
