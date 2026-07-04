import { useState } from "react";
import { responsiveStyles } from "../responsiveStyles";

type ForcedPasswordChangeProps = {
  // Resolves on success (caller refreshes the session, clearing the gate); throws
  // with a message on failure.
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onSignOut: () => void;
};

const MIN_PASSWORD_LENGTH = 8;

const ForcedPasswordChange = ({ onSubmit, onSignOut }: ForcedPasswordChangeProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update password.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className={responsiveStyles.authViewport}>
      <section className={responsiveStyles.authCard}>
        <h1 className={responsiveStyles.authHeading}>Set a new password</h1>
        <p className={responsiveStyles.authDescription}>
          An administrator reset your password. Choose a new one to continue.
        </p>

        {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}

        <form className={responsiveStyles.authForm} onSubmit={handleSubmit}>
          <label className={responsiveStyles.authLabel}>
            <span>Current (temporary) password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <label className={responsiveStyles.authLabel}>
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <label className={responsiveStyles.authLabel}>
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className={responsiveStyles.authInput}
              required
            />
          </label>

          <button
            type="submit"
            className={responsiveStyles.authPrimaryButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save new password"}
          </button>
        </form>

        <div className={responsiveStyles.authHelperRow}>
          <button type="button" className={responsiveStyles.authHelperButton} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
};

export default ForcedPasswordChange;
