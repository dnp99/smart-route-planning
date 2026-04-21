import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import RoutePlanner from "../../features/route-planner/ui/RoutePlanner";
import LoginPage from "../auth/LoginPage";
import LicensePage from "../legal/LicensePage";
import PrivacyPage from "../legal/PrivacyPage";
import TermsPage from "../legal/TermsPage";
import TrademarkPage from "../legal/TrademarkPage";
import PatientsPage from "../../features/patients/ui/PatientsPage";
import HomePage from "../home/HomePage";
import LandingPage from "../LandingPage";
import LegalDocumentModal from "../modals/LegalDocumentModal";
import { responsiveStyles } from "../responsiveStyles";
import WelcomeSetupPage from "../../features/onboarding/ui/WelcomeSetupPage";

export default function AppRoutes({
  isAuthenticated,
  isBootstrapping,
  authUser,
  onOpenAccountSettings,
  optimizationObjective,
  defaultProtectedPath,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = location.state?.backgroundLocation;
  const isLegalRoute = /^\/legal\/(terms|privacy|license|trademark)$/.test(location.pathname);
  const isSetupComplete = Boolean(authUser?.isSetupComplete);
  const authenticatedDefaultPath = isSetupComplete ? defaultProtectedPath : "/welcome-setup";

  const resolveBootstrappingCopy = () => {
    if (location.pathname.indexOf("/clients") === 0) {
      return {
        title: "Loading clients workspace...",
        subtitle: "Syncing your session and client roster.",
      };
    }

    if (location.pathname.indexOf("/route-planner") === 0) {
      return {
        title: "Loading route planner...",
        subtitle: "Preparing your schedule, map, and saved draft.",
      };
    }

    if (location.pathname.indexOf("/home") === 0) {
      return {
        title: "Loading dashboard...",
        subtitle: "Gathering your latest route and performance data.",
      };
    }

    return {
      title: "Validating session...",
      subtitle: "Please wait while we restore your workspace.",
    };
  };

  const renderBootstrappingFallback = () => (
    <main className="mt-3 grid gap-4 sm:gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div role="status" aria-live="polite" className="grid gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 animate-spin items-center justify-center text-blue-600 dark:text-blue-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {resolveBootstrappingCopy().title}
              </p>
              <p className="m-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
                {resolveBootstrappingCopy().subtitle}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <div
              className={`${responsiveStyles.routeSkeletonPulse} h-2.5 w-3/5 rounded-md`}
              aria-hidden="true"
            />
            <div
              className={`${responsiveStyles.routeSkeletonPulse} h-2.5 w-2/5 rounded-md`}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>
    </main>
  );

  const renderProtectedRoute = (element) => {
    if (!isAuthenticated) {
      if (isBootstrapping) return renderBootstrappingFallback();
      return <Navigate to="/login" replace />;
    }

    if (!isSetupComplete) {
      return <Navigate to="/welcome-setup" replace />;
    }

    return element;
  };

  const renderSetupRoute = (element) => {
    if (!isAuthenticated) {
      if (isBootstrapping) return renderBootstrappingFallback();
      return <Navigate to="/login" replace />;
    }

    if (isSetupComplete) {
      return <Navigate to={defaultProtectedPath} replace />;
    }

    return element;
  };

  const renderLandingRoute = () => {
    if (!isAuthenticated) {
      return (
        <LandingPage
          isAuthenticated={isAuthenticated}
          authUser={authUser}
          onOpenAccountSettings={onOpenAccountSettings}
        />
      );
    }

    if (isBootstrapping) return renderBootstrappingFallback();
    return <Navigate to={authenticatedDefaultPath} replace />;
  };

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route
          path="/"
          element={renderLandingRoute()}
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to={authenticatedDefaultPath} replace /> : <LoginPage />
          }
        />
        <Route
          path="/welcome-setup"
          element={renderSetupRoute(<WelcomeSetupPage authUser={authUser} />)}
        />
        <Route path="/clients" element={renderProtectedRoute(<PatientsPage />)} />
        <Route path="/patients" element={<Navigate to="/clients" replace />} />
        <Route
          path="/route-planner"
          element={renderProtectedRoute(
            <RoutePlanner
              nurseHomeAddress={authUser?.homeAddress ?? null}
              nurseWorkingHours={authUser?.workingHours ?? null}
              nurseBreakGapThresholdMinutes={authUser?.breakGapThresholdMinutes ?? null}
              onOpenAccountSettings={onOpenAccountSettings}
              optimizationObjective={optimizationObjective}
            />,
          )}
        />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/license" element={<LicensePage />} />
        <Route path="/legal/trademark" element={<TrademarkPage />} />
        <Route
          path="/home"
          element={renderProtectedRoute(
            <HomePage
              isAuthenticated={isAuthenticated}
              authUser={authUser}
              onOpenAccountSettings={onOpenAccountSettings}
            />,
          )}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? authenticatedDefaultPath : "/login"} replace />}
        />
      </Routes>

      {backgroundLocation && isLegalRoute && (
        <LegalDocumentModal
          title="Legal information"
          onClose={() => {
            navigate(-1);
          }}
        >
          <Routes>
            <Route path="/legal/terms" element={<TermsPage isModal />} />
            <Route path="/legal/privacy" element={<PrivacyPage isModal />} />
            <Route path="/legal/license" element={<LicensePage isModal />} />
            <Route path="/legal/trademark" element={<TrademarkPage isModal />} />
          </Routes>
        </LegalDocumentModal>
      )}
    </>
  );
}
