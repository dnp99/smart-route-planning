import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import RoutePlanner from "./components/RoutePlanner";
import LoginPage from "./components/auth/LoginPage";
import { fetchMe } from "./components/auth/authService";
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
import PatientsPage from "./components/patients/PatientsPage";
import { responsiveStyles } from "./components/responsiveStyles";
import AppHeader from "./components/layout/AppHeader";
import AppFooter from "./components/layout/AppFooter";
import AccountSettingsModal from "./components/layout/AccountSettingsModal";
import ScrollToTopButton from "./components/layout/ScrollToTopButton";

const resolveTabClassName = ({ isActive }) =>
  [
    "group flex items-center gap-2 border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
    isActive
      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
  ].join(" ");

function App() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [isAuthResolved, setIsAuthResolved] = useState(() => !getAuthToken());
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => {
      const nextToken = getAuthToken();
      setAuthToken(nextToken);
      setAuthUser(getAuthUser());
      setIsAuthResolved(!nextToken);
      if (!nextToken) setIsAccountSettingsOpen(false);
    };
    window.addEventListener(getAuthChangedEventName(), handleAuthChange);
    return () => window.removeEventListener(getAuthChangedEventName(), handleAuthChange);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    void fetchMe(authToken)
      .then((result) => { if (active) { setAuthUser(result.user); setIsAuthResolved(true); } })
      .catch(() => { if (active) { clearAuthSession(); setAuthToken(null); setAuthUser(null); setIsAuthResolved(true); } });
    return () => { active = false; };
  }, [authToken]);

  const isAuthenticated = Boolean(authToken);
  const defaultProtectedPath = "/patients";
  const renderProtectedRoute = (element) => isAuthenticated ? element : <Navigate to="/login" replace />;

  if (!isAuthResolved) {
    return (
      <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-6">
        <main className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Validating session...
        </main>
      </div>
    );
  }

  return (
    <div className={responsiveStyles.appShell}>
      <AppHeader
        isAuthenticated={isAuthenticated}
        authUser={authUser}
        onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
        onLogout={clearAuthSession}
      />

      <div className={responsiveStyles.contentWrapper}>
        {isAuthenticated && (
          <nav className={responsiveStyles.tabNav}>
            <NavLink to="/patients" aria-label="Patients" className={resolveTabClassName}>
              {({ isActive }) => (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={["h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"].join(" ")}>
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={["h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"].join(" ")}>
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
          <Route path="/login" element={isAuthenticated ? <Navigate to={defaultProtectedPath} replace /> : <LoginPage />} />
          <Route path="/patients" element={renderProtectedRoute(<PatientsPage />)} />
          <Route
            path="/route-planner"
            element={renderProtectedRoute(
              <RoutePlanner
                nurseHomeAddress={authUser?.homeAddress ?? null}
                nurseWorkingHours={authUser?.workingHours ?? null}
                nurseBreakGapThresholdMinutes={authUser?.breakGapThresholdMinutes ?? null}
                onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
              />,
            )}
          />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/license" element={<LicensePage />} />
          <Route path="/legal/trademark" element={<TrademarkPage />} />
          <Route path="/" element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />} />
        </Routes>
      </div>

      <AppFooter />

      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        authUser={authUser}
        onHomeAddressSaved={(updatedUser) => {
          setAuthUser(updatedUser);
          setStoredAuthUser(updatedUser);
        }}
      />

      <ScrollToTopButton />
    </div>
  );
}

export default App;
