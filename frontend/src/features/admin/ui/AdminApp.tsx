import { responsiveStyles } from "../../../components/responsiveStyles";
import { useAdminAuth } from "../hooks/useAdminAuth";
import AdminLoginPage from "./AdminLoginPage";

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
        <p className={responsiveStyles.cardDescription}>
          Signed in as {admin.displayName}. User activity and metrics load here next.
        </p>
      </main>
    </div>
  );
};

export default AdminApp;
