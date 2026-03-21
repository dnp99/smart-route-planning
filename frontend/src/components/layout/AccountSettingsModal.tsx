import { useEffect, useState } from "react";
import AddressAutocompleteInput from "../AddressAutocompleteInput";
import { updatePassword, updateProfileHomeAddress } from "../auth/authService";
import { clearAuthSession, getAuthToken, setStoredAuthUser } from "../auth/authSession";

const MAX_HOME_ADDRESS_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 8;
const PROFILE_MODAL_HOME_ADDRESS_ID = "account-settings-home-address";

type AuthUser = { displayName?: string; email?: string; homeAddress?: string } | null;

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  onHomeAddressSaved: (updatedUser: AuthUser) => void;
}

const EyeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

export default function AccountSettingsModal({ isOpen, onClose, authUser, onHomeAddressSaved }: AccountSettingsModalProps) {
  const [homeAddressInput, setHomeAddressInput] = useState("");
  const [accountSettingsError, setAccountSettingsError] = useState("");
  const [accountSettingsSuccess, setAccountSettingsSuccess] = useState("");
  const [isSavingAccountSettings, setIsSavingAccountSettings] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset form state when opening
  useEffect(() => {
    if (!isOpen) return;
    setHomeAddressInput(authUser?.homeAddress ?? "");
    setAccountSettingsError("");
    setAccountSettingsSuccess("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSavingAccountSettings, isUpdatingPassword]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (isSavingAccountSettings || isUpdatingPassword) return;
    setAccountSettingsError("");
    setAccountSettingsSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
    onClose();
  };

  const handleAccountSettingsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAccountSettingsError("");
    setAccountSettingsSuccess("");

    const normalized = homeAddressInput.trim();
    if (!normalized) {
      setAccountSettingsError("Home address is required.");
      return;
    }
    if (normalized.length > MAX_HOME_ADDRESS_LENGTH) {
      setAccountSettingsError("Home address must be 200 characters or fewer.");
      return;
    }

    const token = getAuthToken();
    if (!token || !authUser) { clearAuthSession(); return; }

    setIsSavingAccountSettings(true);
    try {
      const updated = await updateProfileHomeAddress(token, normalized);
      setStoredAuthUser(updated.user);
      onHomeAddressSaved(updated.user);
      setAccountSettingsSuccess("Account settings saved.");
    } catch (err) {
      setAccountSettingsError(err instanceof Error ? err.message : "Unable to update account settings.");
    } finally {
      setIsSavingAccountSettings(false);
    }
  };

  const handlePasswordUpdateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPasswordInput.trim()) { setPasswordError("Current password is required."); return; }
    if (newPasswordInput.length < MIN_PASSWORD_LENGTH) { setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (newPasswordInput !== confirmPasswordInput) { setPasswordError("Passwords do not match."); return; }
    if (currentPasswordInput === newPasswordInput) { setPasswordError("New password must differ from current password."); return; }

    const token = getAuthToken();
    if (!token || !authUser) { clearAuthSession(); return; }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(token, currentPasswordInput, newPasswordInput);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-3"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:p-5">
        <div className="sm:hidden -mx-4 -mt-4 mb-3 flex justify-center pb-1 pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Account settings
            </h2>
            <p className="m-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
              Manage account profile details for route-planning defaults.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSavingAccountSettings}
            aria-label="Close modal"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="grid gap-4" onSubmit={handleAccountSettingsSubmit}>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Email</span>
            <input
              type="email"
              value={authUser?.email ?? ""}
              readOnly
              disabled
              className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
          </label>

          <AddressAutocompleteInput
            id={PROFILE_MODAL_HOME_ADDRESS_ID}
            label="Home address"
            placeholder="Pearson International Airport"
            value={homeAddressInput}
            onChange={(value) => {
              setHomeAddressInput(value.slice(0, MAX_HOME_ADDRESS_LENGTH));
              if (accountSettingsError) setAccountSettingsError("");
              if (accountSettingsSuccess) setAccountSettingsSuccess("");
            }}
            helperText="Used to prefill default start and ending points in Route Planner."
            disabled={isSavingAccountSettings}
          />

          {accountSettingsError && (
            <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
              {accountSettingsError}
            </p>
          )}
          {accountSettingsSuccess && (
            <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              {accountSettingsSuccess}
            </p>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSavingAccountSettings}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingAccountSettings}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingAccountSettings ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

        <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

        <form className="grid gap-3" onSubmit={handlePasswordUpdateSubmit}>
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Security</p>

          {(["current", "new", "confirm"] as const).map((field) => {
            const isConfirm = field === "confirm";
            const isCurrent = field === "current";
            const value = isCurrent ? currentPasswordInput : isConfirm ? confirmPasswordInput : newPasswordInput;
            const show = isCurrent ? showCurrentPassword : isConfirm ? showConfirmPassword : showNewPassword;
            const setShow = isCurrent ? setShowCurrentPassword : isConfirm ? setShowConfirmPassword : setShowNewPassword;
            const setValue = isCurrent
              ? (v: string) => { setCurrentPasswordInput(v); if (passwordError) setPasswordError(""); if (passwordSuccess) setPasswordSuccess(""); }
              : isConfirm
              ? (v: string) => { setConfirmPasswordInput(v); if (passwordError) setPasswordError(""); if (passwordSuccess) setPasswordSuccess(""); }
              : (v: string) => { setNewPasswordInput(v); if (passwordError) setPasswordError(""); if (passwordSuccess) setPasswordSuccess(""); };
            const label = isCurrent ? "Current password" : isConfirm ? "Confirm new password" : "New password";
            const autoComplete = isCurrent ? "current-password" : "new-password";
            const confirmBorderClass = isConfirm && confirmPasswordInput.length > 0
              ? confirmPasswordInput === newPasswordInput
                ? "border-emerald-500 focus:border-emerald-500 dark:border-emerald-500"
                : "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-400"
              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700";

            return (
              <label key={field} className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">{label}</span>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoComplete={autoComplete}
                    disabled={isUpdatingPassword}
                    className={[
                      "w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 sm:px-4 sm:py-3",
                      isConfirm ? confirmBorderClass : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            );
          })}

          {passwordError && (
            <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              {passwordSuccess}
            </p>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <button
              type="submit"
              disabled={isUpdatingPassword || !(currentPasswordInput.length > 0 && newPasswordInput.length > 0 && confirmPasswordInput === newPasswordInput)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdatingPassword ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
