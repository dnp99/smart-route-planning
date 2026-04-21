import { useEffect, useState } from "react";
import {
  acknowledgeLegalNotice,
  fetchLegalNoticeStatus,
  fetchMe,
  logout,
} from "./components/auth/authService";
import {
  beginAuthBootstrap,
  completeAuthBootstrap,
  clearAuthSession,
  getAuthChangedEventName,
  getAuthUser,
  getSessionPresenceFlag,
  recordAuthBootstrapFailure,
  recordAuthBootstrapTimeout,
  setStoredAuthUser,
} from "./components/auth/authSession";
import { responsiveStyles } from "./components/responsiveStyles";
import AppHeader from "./components/layout/AppHeader";
import AppFooter from "./components/layout/AppFooter";
import AccountSettingsModal from "./components/modals/AccountSettingsModal";
import LegalAcknowledgementModal from "./components/modals/LegalAcknowledgementModal";
import ScrollToTopButton from "./components/layout/ScrollToTopButton";
import AppRoutes from "./components/navigation/AppRoutes";
import AppTabs from "./components/navigation/AppTabs";
import AuthBootstrapLoader from "./components/shared/AuthBootstrapLoader";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

function App() {
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [isAuthResolved, setIsAuthResolved] = useState(() => getSessionPresenceFlag());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isLegalNoticeRequired, setIsLegalNoticeRequired] = useState(false);
  const [isLegalNoticeSubmitting, setIsLegalNoticeSubmitting] = useState(false);
  const [legalNoticeError, setLegalNoticeError] = useState("");
  const isAuthenticated = Boolean(authUser);

  useEffect(() => {
    const handleAuthChange = () => {
      const nextUser = getAuthUser();
      setAuthUser(nextUser);
      if (!nextUser) {
        setIsAccountSettingsOpen(false);
        setIsLegalNoticeRequired(false);
        setLegalNoticeError("");
      }
    };
    window.addEventListener(getAuthChangedEventName(), handleAuthChange);
    return () => window.removeEventListener(getAuthChangedEventName(), handleAuthChange);
  }, []);

  useEffect(() => {
    const hasPresenceFlag = getSessionPresenceFlag();
    if (hasPresenceFlag) {
      beginAuthBootstrap();
    }
    const bootstrapTimeoutId =
      hasPresenceFlag && typeof window !== "undefined"
        ? window.setTimeout(() => {
            recordAuthBootstrapTimeout(AUTH_BOOTSTRAP_TIMEOUT_MS);
            completeAuthBootstrap();
          }, AUTH_BOOTSTRAP_TIMEOUT_MS)
        : null;

    let active = true;
    void fetchMe()
      .then((result) => {
        if (active) {
          setStoredAuthUser(result.user);
          setIsAuthResolved(true);
          setIsBootstrapping(false);
        }
      })
      .catch((error) => {
        if (active) {
          if (hasPresenceFlag) {
            recordAuthBootstrapFailure(error);
          }
          if (getAuthUser()) {
            clearAuthSession();
          }
          setAuthUser(null);
          setIsLegalNoticeRequired(false);
          setLegalNoticeError("");
          setIsAuthResolved(true);
          setIsBootstrapping(false);
        }
      })
      .finally(() => {
        if (bootstrapTimeoutId !== null && typeof window !== "undefined") {
          window.clearTimeout(bootstrapTimeoutId);
        }
        completeAuthBootstrap();
      });
    return () => {
      active = false;
      if (bootstrapTimeoutId !== null && typeof window !== "undefined") {
        window.clearTimeout(bootstrapTimeoutId);
      }
      completeAuthBootstrap();
    };
  }, []);

  useEffect(() => {
    if (!isAuthResolved || !isAuthenticated) {
      return;
    }

    let active = true;
    void fetchLegalNoticeStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setIsLegalNoticeRequired(status.required);
        setLegalNoticeError("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setIsLegalNoticeRequired(false);
        setLegalNoticeError(
          error instanceof Error ? error.message : "Unable to load legal notice status.",
        );
      });

    return () => {
      active = false;
    };
  }, [isAuthResolved, isAuthenticated]);

  const handleLegalNoticeAgree = () => {
    setIsLegalNoticeSubmitting(true);
    setLegalNoticeError("");
    void acknowledgeLegalNotice()
      .then((status) => {
        setIsLegalNoticeRequired(status.required);
      })
      .catch((error) => {
        setLegalNoticeError(
          error instanceof Error ? error.message : "Unable to save legal notice acknowledgement.",
        );
      })
      .finally(() => {
        setIsLegalNoticeSubmitting(false);
      });
  };

  const optimizationObjective = authUser?.optimizationObjective ?? "distance";
  const defaultProtectedPath = "/home";

  if (isBootstrapping) {
    return <AuthBootstrapLoader />;
  }

  return (
    <div className={responsiveStyles.appShell}>
      <div className={responsiveStyles.stickyHeaderShell}>
        <AppHeader
          isAuthenticated={isAuthenticated}
          authUser={authUser}
          onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
          onLogout={() => {
            void logout();
            clearAuthSession();
          }}
        />
        {isAuthenticated && (
          <div className={responsiveStyles.tabStrip}>
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
              <AppTabs />
            </div>
          </div>
        )}
      </div>

      <div className={responsiveStyles.contentWrapper}>
        <AppRoutes
          isAuthenticated={isAuthenticated}
          isBootstrapping={isBootstrapping}
          authUser={authUser}
          onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
          optimizationObjective={optimizationObjective}
          defaultProtectedPath={defaultProtectedPath}
        />
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
      <LegalAcknowledgementModal
        isOpen={isAuthenticated && isLegalNoticeRequired}
        isSubmitting={isLegalNoticeSubmitting}
        error={legalNoticeError}
        onAgree={handleLegalNoticeAgree}
      />
      <ScrollToTopButton />
    </div>
  );
}

export default App;
