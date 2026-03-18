import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import AddressAutocompleteInput from "./components/AddressAutocompleteInput";
import RoutePlanner from "./components/RoutePlanner";
import LoginPage from "./components/auth/LoginPage";
import { fetchMe, updatePassword, updateProfileHomeAddress } from "./components/auth/authService";
import {
  clearAuthSession,
  getAuthChangedEventName,
  getAuthToken,
  getAuthUser,
  setStoredAuthUser,
} from "./components/auth/authSession";
import { formatNameWords } from "./components/patients/patientName";
import PatientsPage from "./components/patients/PatientsPage";

const resolveTabCardClassName = ({ isActive }) =>
  [
    "block rounded-xl border p-2.5 transition sm:p-3",
    isActive
      ? "border-blue-600 bg-blue-50"
      : "border-slate-200 bg-slate-100 hover:bg-slate-200",
  ].join(" ");

const OptionsIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const EyeIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const MAX_HOME_ADDRESS_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 8;
const PROFILE_MODAL_HOME_ADDRESS_ID = "account-settings-home-address";

function App() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [isAuthResolved, setIsAuthResolved] = useState(() => !getAuthToken());
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
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
  const accountMenuRef = useRef(null);

  useEffect(() => {
    const handleAuthChange = () => {
      const nextToken = getAuthToken();
      setAuthToken(nextToken);
      setAuthUser(getAuthUser());
      setIsAuthResolved(!nextToken);
      if (!nextToken) {
        setIsAccountMenuOpen(false);
        setIsAccountSettingsOpen(false);
      }
    };

    window.addEventListener(getAuthChangedEventName(), handleAuthChange);
    return () => {
      window.removeEventListener(getAuthChangedEventName(), handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let isSubscribed = true;

    void fetchMe(authToken)
      .then((result) => {
        if (!isSubscribed) {
          return;
        }

        setAuthUser(result.user);
        setIsAuthResolved(true);
      })
      .catch(() => {
        if (!isSubscribed) {
          return;
        }

        clearAuthSession();
        setAuthToken(null);
        setAuthUser(null);
        setIsAuthResolved(true);
      });

    return () => {
      isSubscribed = false;
    };
  }, [authToken]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current) {
        return;
      }

      if (!accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const isAuthenticated = Boolean(authToken);
  const defaultProtectedPath = "/patients";
  const formattedDisplayName =
    typeof authUser?.displayName === "string"
      ? formatNameWords(authUser.displayName)
      : "";
  const workspaceSubtitle = formattedDisplayName
    ? `Nurse operations workspace for ${formattedDisplayName}`
    : "Nurse operations workspace";
  const normalizedProfileHomeAddress = authUser?.homeAddress ?? "";

  useEffect(() => {
    if (!isAccountSettingsOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountSettingsOpen(false);
        setAccountSettingsError("");
        setAccountSettingsSuccess("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountSettingsOpen]);

  const openAccountSettingsModal = () => {
    setHomeAddressInput(normalizedProfileHomeAddress);
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
    setIsAccountMenuOpen(false);
    setIsAccountSettingsOpen(true);
  };

  const closeAccountSettingsModal = () => {
    if (isSavingAccountSettings || isUpdatingPassword) {
      return;
    }

    setIsAccountSettingsOpen(false);
    setAccountSettingsError("");
    setAccountSettingsSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleAccountSettingsSubmit = async (event) => {
    event.preventDefault();
    setAccountSettingsError("");
    setAccountSettingsSuccess("");

    const normalizedHomeAddress = homeAddressInput.trim();
    if (!normalizedHomeAddress) {
      setAccountSettingsError("Home address is required.");
      return;
    }

    if (normalizedHomeAddress.length > MAX_HOME_ADDRESS_LENGTH) {
      setAccountSettingsError("Home address must be 200 characters or fewer.");
      return;
    }

    if (!authToken || !authUser) {
      clearAuthSession();
      return;
    }

    setIsSavingAccountSettings(true);
    try {
      const updated = await updateProfileHomeAddress(authToken, normalizedHomeAddress);
      setAuthUser(updated.user);
      setStoredAuthUser(updated.user);
      setAccountSettingsSuccess("Account settings saved.");
    } catch (saveError) {
      setAccountSettingsError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update account settings.",
      );
    } finally {
      setIsSavingAccountSettings(false);
    }
  };

  const handlePasswordUpdateSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPasswordInput.trim()) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPasswordInput.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (currentPasswordInput === newPasswordInput) {
      setPasswordError("New password must differ from current password.");
      return;
    }

    if (!authToken || !authUser) {
      clearAuthSession();
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(authToken, currentPasswordInput, newPasswordInput);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setPasswordSuccess("Password updated successfully.");
    } catch (updateError) {
      setPasswordError(
        updateError instanceof Error ? updateError.message : "Unable to update password.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const renderProtectedRoute = (element) =>
    isAuthenticated ? element : <Navigate to="/login" replace />;

  if (!isAuthResolved) {
    return (
      <div className="mx-auto w-full max-w-4xl p-3 sm:p-4 md:p-6">
        <main className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Validating session...
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-4 md:p-6">
      <header className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-base font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300 sm:text-lg">
                CareFlow
              </p>
              <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">
                {workspaceSubtitle}
              </p>
            </div>

            {isAuthenticated ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
                  aria-label="Open account options menu"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  title="Open account options menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <OptionsIcon className="h-4 w-4" />
                </button>

                {isAccountMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account options menu"
                    className="absolute right-0 z-20 mt-2 min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openAccountSettingsModal}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Account settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        clearAuthSession();
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="m-0 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Authentication required
              </p>
            )}
          </div>

          {isAuthenticated && (
            <div className="border-t border-slate-200 pt-2.5 dark:border-slate-800">
              <nav className="grid w-full grid-cols-2 gap-1.5">
                <NavLink to="/patients" aria-label="Patients" className={resolveTabCardClassName}>
                  {({ isActive }) => (
                    <div>
                      <p
                        className={[
                          "m-0 text-left text-sm font-semibold leading-tight sm:text-base",
                          isActive ? "text-blue-700" : "text-slate-900",
                        ].join(" ")}
                      >
                        Patients
                      </p>
                      <p
                        className={[
                          "m-0 mt-0.5 hidden text-left text-[11px] font-medium leading-tight sm:block sm:text-xs",
                          isActive ? "text-blue-600" : "text-slate-600",
                        ].join(" ")}
                      >
                        Search, create, and manage patient visits.
                      </p>
                    </div>
                  )}
                </NavLink>
                <NavLink
                  to="/route-planner"
                  aria-label="Route Planner"
                  className={resolveTabCardClassName}
                >
                  {({ isActive }) => (
                    <div>
                      <p
                        className={[
                          "m-0 text-left text-sm font-semibold leading-tight sm:text-base",
                          isActive ? "text-blue-700" : "text-slate-900",
                        ].join(" ")}
                      >
                        Route Planner
                      </p>
                      <p
                        className={[
                          "m-0 mt-0.5 hidden text-left text-[11px] font-medium leading-tight sm:block sm:text-xs",
                          isActive ? "text-blue-600" : "text-slate-600",
                        ].join(" ")}
                      >
                        Build and optimize your daily route plan.
                      </p>
                    </div>
                  )}
                </NavLink>
              </nav>
            </div>
          )}
        </div>
      </header>

      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={defaultProtectedPath} replace /> : <LoginPage />}
        />
        <Route path="/patients" element={renderProtectedRoute(<PatientsPage />)} />
        <Route
          path="/route-planner"
          element={renderProtectedRoute(
            <RoutePlanner
              nurseHomeAddress={authUser?.homeAddress ?? null}
              onOpenAccountSettings={openAccountSettingsModal}
            />,
          )}
        />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />}
        />
      </Routes>

      {isAccountSettingsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-3"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAccountSettingsModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="mb-4">
              <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Account settings
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
                Manage account profile details for route-planning defaults.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleAccountSettingsSubmit}>
              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold">Email</span>
                <input
                  type="email"
                  value={authUser?.email ?? ""}
                  readOnly
                  disabled
                  className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
              </label>

              <AddressAutocompleteInput
                id={PROFILE_MODAL_HOME_ADDRESS_ID}
                label="Home address"
                placeholder="Perason Internal Airport"
                value={homeAddressInput}
                onChange={(value) => {
                  setHomeAddressInput(value.slice(0, MAX_HOME_ADDRESS_LENGTH));
                  if (accountSettingsError) {
                    setAccountSettingsError("");
                  }
                  if (accountSettingsSuccess) {
                    setAccountSettingsSuccess("");
                  }
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

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAccountSettingsModal}
                  disabled={isSavingAccountSettings}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccountSettings}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingAccountSettings ? "Saving..." : "Save"}
                </button>
              </div>
            </form>

            <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

            <form className="grid gap-3" onSubmit={handlePasswordUpdateSubmit}>
              <p className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Security
              </p>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Current password</span>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPasswordInput}
                    onChange={(event) => {
                      setCurrentPasswordInput(event.target.value);
                      if (passwordError) setPasswordError("");
                      if (passwordSuccess) setPasswordSuccess("");
                    }}
                    autoComplete="current-password"
                    disabled={isUpdatingPassword}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showCurrentPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">New password</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPasswordInput}
                    onChange={(event) => {
                      setNewPasswordInput(event.target.value);
                      if (passwordError) setPasswordError("");
                      if (passwordSuccess) setPasswordSuccess("");
                    }}
                    autoComplete="new-password"
                    disabled={isUpdatingPassword}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showNewPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Confirm new password</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPasswordInput}
                    onChange={(event) => {
                      setConfirmPasswordInput(event.target.value);
                      if (passwordError) setPasswordError("");
                      if (passwordSuccess) setPasswordSuccess("");
                    }}
                    autoComplete="new-password"
                    disabled={isUpdatingPassword}
                    className={[
                      "w-full rounded-xl border px-3 py-2 pr-10 text-sm text-slate-900 transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-800 dark:text-slate-100",
                      confirmPasswordInput.length > 0
                        ? confirmPasswordInput === newPasswordInput
                          ? "border-emerald-500 focus:border-emerald-500 dark:border-emerald-500"
                          : "border-red-400 focus:border-red-400 dark:border-red-400"
                        : "border-slate-300 focus:border-blue-500 dark:border-slate-700",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

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

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUpdatingPassword ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
