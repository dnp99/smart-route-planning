import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminDashboard } from "../hooks/useAdminDashboard";
import { useAdminNurseActions } from "../hooks/useAdminNurseActions";
import { useAdminNurseDetail } from "../hooks/useAdminNurseDetail";
import AdminDashboardPage from "./AdminDashboardPage";
import AdminNurseDetailPage from "./AdminNurseDetailPage";
import AdminLoginPage from "./AdminLoginPage";

// Dashboard route container — wires the data hook to the view and navigation.
const AdminDashboardRoute = () => {
  const navigate = useNavigate();
  const { nurses, metrics, isLoading, error } = useAdminDashboard();

  return (
    <AdminDashboardPage
      nurses={nurses}
      metrics={metrics}
      isLoading={isLoading}
      error={error}
      onSelectNurse={(nurseId) => navigate(`/admin/nurses/${nurseId}`)}
    />
  );
};

// Nurse-detail route container. The read is audited server-side (admin.nurse.view).
const AdminNurseDetailRoute = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { detail, isLoading, error, reload } = useAdminNurseDetail(id);
  const {
    isBusy,
    actionError,
    temporaryPassword,
    deactivate,
    reactivate,
    resetPassword,
    dismissTemporaryPassword,
  } = useAdminNurseActions(id, reload);

  return (
    <AdminNurseDetailPage
      detail={detail}
      isLoading={isLoading}
      error={error}
      onBack={() => navigate("/admin")}
      isBusy={isBusy}
      actionError={actionError}
      temporaryPassword={temporaryPassword}
      onDeactivate={() => void deactivate()}
      onReactivate={() => void reactivate()}
      onResetPassword={() => void resetPassword()}
      onDismissTemporaryPassword={dismissTemporaryPassword}
    />
  );
};

// Root of the isolated /admin/* area. Gates on the admin session: unresolved →
// nothing (brief), signed-out → login, signed-in → the admin shell. Rendered by
// App outside the nurse shell, so it never inherits nurse chrome or auth.
const AdminApp = () => {
  const { admin, isResolving, isSigningIn, error, signIn, signOut } = useAdminAuth();

  if (isResolving) {
    return <main className={responsiveStyles.authViewport} aria-busy="true" />;
  }

  if (!admin) {
    return (
      <AdminLoginPage
        onSignIn={(email, password) => void signIn(email, password)}
        isSigningIn={isSigningIn}
        error={error}
      />
    );
  }

  return (
    <div className={responsiveStyles.adminShell}>
      <header className={responsiveStyles.adminTopBar}>
        <div className={responsiveStyles.adminTopBarInner}>
          <div>
            <p className={responsiveStyles.adminEyebrow}>Routefy Admin</p>
            <h1 className={responsiveStyles.adminBrand}>Dashboard</h1>
          </div>
          <div className={responsiveStyles.adminTopBarMeta}>
            <span className="hidden sm:inline">{admin.email}</span>
            <button
              type="button"
              className={responsiveStyles.adminSignOutButton}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className={responsiveStyles.adminContent}>
        <Routes>
          <Route path="/admin" element={<AdminDashboardRoute />} />
          <Route path="/admin/nurses/:id" element={<AdminNurseDetailRoute />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminApp;
