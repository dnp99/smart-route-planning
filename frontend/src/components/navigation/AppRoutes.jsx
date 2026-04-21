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

  const renderProtectedRoute = (element) => {
    if (isAuthenticated) return element;
    if (isBootstrapping) return null;
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
