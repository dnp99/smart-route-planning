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

  const renderBootstrappingFallback = () => (
    <main className="mt-3 grid gap-4 sm:gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:p-5">
        Validating session...
      </section>
    </main>
  );

  const renderProtectedRoute = (element) => {
    if (isAuthenticated) return element;
    if (isBootstrapping) return renderBootstrappingFallback();
    return <Navigate to="/login" replace />;
  };

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <LandingPage
                isAuthenticated={isAuthenticated}
                authUser={authUser}
                onOpenAccountSettings={onOpenAccountSettings}
              />
            )
          }
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />}
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
          element={<Navigate to={isAuthenticated ? defaultProtectedPath : "/login"} replace />}
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
