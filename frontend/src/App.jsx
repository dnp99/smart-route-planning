import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import RoutePlanner from "./components/RoutePlanner";
import LoginPage from "./components/auth/LoginPage";
import { fetchMe } from "./components/auth/authService";
import {
  clearAuthSession,
  getAuthChangedEventName,
  getAuthToken,
  getAuthUser,
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

const LogoutIcon = ({ className }) => (
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
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function App() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [isAuthResolved, setIsAuthResolved] = useState(() => !getAuthToken());
  const [isLogoutMenuOpen, setIsLogoutMenuOpen] = useState(false);
  const logoutMenuRef = useRef(null);

  useEffect(() => {
    const handleAuthChange = () => {
      const nextToken = getAuthToken();
      setAuthToken(nextToken);
      setAuthUser(getAuthUser());
      setIsAuthResolved(!nextToken);
      if (!nextToken) {
        setIsLogoutMenuOpen(false);
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
    if (!isLogoutMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!logoutMenuRef.current) {
        return;
      }

      if (!logoutMenuRef.current.contains(event.target)) {
        setIsLogoutMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsLogoutMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLogoutMenuOpen]);

  const isAuthenticated = Boolean(authToken);
  const defaultProtectedPath = "/patients";
  const formattedDisplayName =
    typeof authUser?.displayName === "string"
      ? formatNameWords(authUser.displayName)
      : "";
  const workspaceSubtitle = formattedDisplayName
    ? `Nurse operations workspace for ${formattedDisplayName}`
    : "Nurse operations workspace";

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
              <div ref={logoutMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsLogoutMenuOpen((current) => !current)}
                  aria-label="Open logout menu"
                  aria-haspopup="menu"
                  aria-expanded={isLogoutMenuOpen}
                  title="Open logout menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <LogoutIcon className="h-4 w-4" />
                </button>

                {isLogoutMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Logout menu"
                    className="absolute right-0 z-20 mt-2 min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsLogoutMenuOpen(false);
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
        <Route path="/route-planner" element={renderProtectedRoute(<RoutePlanner />)} />
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
  );
}

export default App;
