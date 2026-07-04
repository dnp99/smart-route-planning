import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminDashboard } from "../hooks/useAdminDashboard";
import AdminDashboardPage from "./AdminDashboardPage";
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
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminApp;
