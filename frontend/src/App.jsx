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
import LicensePage from "./components/legal/LicensePage";
import PrivacyPage from "./components/legal/PrivacyPage";
import TermsPage from "./components/legal/TermsPage";
import TrademarkPage from "./components/legal/TrademarkPage";
import nurseQuotes from "./data/nurseQuotes";
import { formatNameWords } from "./components/patients/patientName";
import PatientsPage from "./components/patients/PatientsPage";

const resolveTabClassName = ({ isActive }) =>
  [
    "group flex items-center gap-2 border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
    isActive
      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
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
const HEADER_QUOTE_STORAGE_KEY = "careflow.headerQuote";

const pickRandomQuote = (currentQuote = null) => {
  if (!Array.isArray(nurseQuotes) || nurseQuotes.length === 0) {
    return null;
  }

  if (nurseQuotes.length === 1) {
    return nurseQuotes[0];
  }

  let next = nurseQuotes[Math.floor(Math.random() * nurseQuotes.length)];
  if (currentQuote && typeof currentQuote.content === "string") {
    while (next.content === currentQuote.content) {
      next = nurseQuotes[Math.floor(Math.random() * nurseQuotes.length)];
    }
  }

  return next;
};

const readStoredHeaderQuote = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedContent = window.localStorage.getItem(HEADER_QUOTE_STORAGE_KEY);
  if (!storedContent) {
    return null;
  }

  const matchedQuote = nurseQuotes.find((quote) => quote.content === storedContent);
  return matchedQuote ?? null;
};

function App() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [isAuthResolved, setIsAuthResolved] = useState(() => !getAuthToken());
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [headerQuote, setHeaderQuote] = useState(() => readStoredHeaderQuote());
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
  const [showScrollTop, setShowScrollTop] = useState(false);
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

  useEffect(() => {
    if (!isAuthenticated) {
      setHeaderQuote(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(HEADER_QUOTE_STORAGE_KEY);
      }
      return;
    }

    setHeaderQuote((current) => {
      const next = current ?? readStoredHeaderQuote() ?? pickRandomQuote();
      if (next && typeof window !== "undefined") {
        window.localStorage.setItem(HEADER_QUOTE_STORAGE_KEY, next.content);
      }
      return next;
    });
  }, [isAuthenticated]);
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

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
      <div className="mx-auto w-full max-w-6xl p-3 sm:p-4 md:p-6">
        <main className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Validating session...
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white dark:bg-none dark:bg-slate-950">
      <header className="z-30 w-full overflow-x-clip border-b border-slate-200 bg-white px-4 py-3 shadow-md dark:border-slate-800 dark:bg-slate-900 sm:sticky sm:top-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                >
                  {/* ECG / pulse line */}
                  <path d="M1 12 L5 12 L7 5 L9 19 L11 12 L13 12" />
                  {/* Map pin — route destination */}
                  <path d="M19 5C16.8 5 15 6.8 15 9C15 11.8 19 17 19 17C19 17 23 11.8 23 9C23 6.8 21.2 5 19 5Z" />
                  <circle cx="19" cy="9" r="1.8" fill="currentColor" strokeWidth="0" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="m-0 text-base font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300 sm:text-lg">
                  CareFlow
                </p>
                <p className="m-0 mt-0.5 truncate text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                  {workspaceSubtitle}
                </p>
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {isAuthenticated && headerQuote && (
                <p className="m-0 hidden min-w-0 max-w-[42ch] text-right text-xs italic text-slate-600 sm:block sm:line-clamp-2 sm:text-sm dark:text-slate-300">
                  &ldquo;{headerQuote.content}&rdquo;
                </p>
              )}

              {!isAuthenticated && (
                <p className="m-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              )}

              {isAuthenticated ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
                  aria-label="Open account options menu"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  title="Open account options menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <OptionsIcon className="h-4 w-4" />
                </button>

                {isAccountMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account options menu"
                    className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openAccountSettingsModal}
                      className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Account settings
                    </button>
                    <hr className="my-1 border-slate-200 dark:border-slate-700" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        clearAuthSession();
                      }}
                      className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
              ) : null}
            </div>
          </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 sm:px-6">
      {isAuthenticated && (
        <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
          <NavLink to="/patients" aria-label="Patients" className={resolveTabClassName}>
            {({ isActive }) => (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={["h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"].join(" ")}
                >
                  <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                  <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                  <circle cx="20" cy="10" r="2" />
                </svg>
                Patients
              </>
            )}
          </NavLink>
          <NavLink to="/route-planner" aria-label="Route Planner" className={resolveTabClassName}>
            {({ isActive }) => (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={["h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"].join(" ")}
                >
                  <circle cx="3" cy="6" r="2" />
                  <circle cx="21" cy="6" r="2" />
                  <circle cx="12" cy="18" r="2" />
                  <path d="M5 6h6l4.5 6H21" />
                  <path d="M3 6l4.5 6H12" />
                  <path d="M12 16V8" />
                </svg>
                Route Planner
              </>
            )}
          </NavLink>
        </nav>
      )}
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
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/license" element={<LicensePage />} />
        <Route path="/legal/trademark" element={<TrademarkPage />} />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />}
        />
      </Routes>

      </div>

      <footer className="w-full border-t border-slate-200 bg-white px-4 py-4 shadow-md dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Legal and support links" className="flex flex-wrap gap-x-3 gap-y-0">
            <a
              href="mailto:dpatel1995@yahoo.com"
              className="py-1 text-xs text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:underline dark:text-slate-300 dark:hover:text-slate-100"
            >
              Contact Us
            </a>
            <NavLink
              to="/legal/terms"
              className="py-1 text-xs text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:underline dark:text-slate-300 dark:hover:text-slate-100"
            >
              Terms
            </NavLink>
            <NavLink
              to="/legal/privacy"
              className="py-1 text-xs text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:underline dark:text-slate-300 dark:hover:text-slate-100"
            >
              Privacy
            </NavLink>
            <NavLink
              to="/legal/license"
              className="py-1 text-xs text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:underline dark:text-slate-300 dark:hover:text-slate-100"
            >
              License
            </NavLink>
            <NavLink
              to="/legal/trademark"
              className="py-1 text-xs text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:underline dark:text-slate-300 dark:hover:text-slate-100"
            >
              Trademark
            </NavLink>
          </nav>
          <div className="flex flex-col gap-0.5 sm:text-right">
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              &copy; {new Date().getFullYear()} CareFlow. All rights reserved.
            </p>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              CareFlow is a trademark of CareFlow.
            </p>
          </div>
        </div>
      </footer>

      {isAccountSettingsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-3"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAccountSettingsModal();
            }
          }}
        >
          <div className="animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:p-5">
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
                onClick={closeAccountSettingsModal}
                disabled={isSavingAccountSettings}
                aria-label="Close modal"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

              <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
                <button
                  type="button"
                  onClick={closeAccountSettingsModal}
                  disabled={isSavingAccountSettings}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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

              <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !(currentPasswordInput.length > 0 && newPasswordInput.length > 0 && confirmPasswordInput === newPasswordInput)}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUpdatingPassword ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          title="Scroll to top"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 shadow-md backdrop-blur transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 lg:bottom-6 lg:left-[calc(50%+36rem+0.75rem)] lg:right-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 text-slate-600 dark:text-slate-300"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
