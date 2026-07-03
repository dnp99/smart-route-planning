import { Link, useLocation } from "react-router-dom";
import type { WeeklyWorkingHours } from "../../../../shared/contracts";
import { responsiveStyles } from "../responsiveStyles";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import AccountMenu from "./AccountMenu";
import NotificationsMenu from "../notifications/NotificationsMenu";

type AuthUser = {
  displayName?: string;
  email?: string;
  homeAddress?: string;
  workingHours?: WeeklyWorkingHours | null;
} | null;

interface AppHeaderProps {
  isAuthenticated: boolean;
  authUser: AuthUser;
  onOpenAccountSettings: () => void;
  onLogout: () => void;
}

// Breadcrumb leaf label per route (the "Home" root is always shown).
const CRUMB_LABEL: Record<string, string> = {
  "/clients": "Clients",
  "/route-planner": "Route Planner",
};

const resolveCrumbLabel = (pathname: string) => {
  const key = Object.keys(CRUMB_LABEL).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return key ? CRUMB_LABEL[key] : null;
};

export default function AppHeader({
  isAuthenticated,
  authUser,
  onOpenAccountSettings,
  onLogout,
}: AppHeaderProps) {
  const { pathname } = useLocation();
  const crumbLabel = resolveCrumbLabel(pathname);
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const brand = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
        <RoutefyBrandMark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </span>
      <span className="text-lg font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
        Routefy
      </span>
    </>
  );

  return (
    <header className={responsiveStyles.appHeader}>
      <div
        className={[
          // Keep horizontal insets in sync with responsiveStyles.contentWrapper
          // so the breadcrumb aligns with the page H1 below it.
          "mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 md:pl-1 md:pr-[60px]",
          isAuthenticated ? "" : "justify-center",
        ].join(" ")}
      >
        {isAuthenticated ? (
          <>
            {/* Brand shows on mobile only (no sidebar there). */}
            <Link
              to="/home"
              aria-label="Routefy home"
              className="flex items-center gap-2.5 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 md:hidden"
            >
              {brand}
            </Link>

            {/* Breadcrumb takes the left on desktop. */}
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex">
              <Link
                to="/home"
                className="text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Home
              </Link>
              {crumbLabel && (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {crumbLabel}
                  </span>
                </>
              )}
            </nav>

            <div className="flex-1" />

            <div className="flex items-center gap-2.5">
              <span className={`${responsiveStyles.topBarDatePill} hidden md:inline-flex`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {dateLabel}
              </span>
              <NotificationsMenu
                authUser={authUser}
                onOpenAccountSettings={onOpenAccountSettings}
                className="hidden md:inline-flex"
              />
              {/* Divider before the account avatar (desktop only): date · bell | avatar. */}
              <span className={responsiveStyles.topBarDivider} aria-hidden="true" />
              {/* Desktop: Account settings lives in the sidebar Settings row, so the
                  header avatar menu is Logout only. */}
              <AccountMenu
                authUser={authUser}
                isAuthenticated={isAuthenticated}
                onOpenAccountSettings={onOpenAccountSettings}
                onLogout={onLogout}
                variant="avatar"
                items="logoutOnly"
                className="hidden md:block"
              />
              {/* Mobile: no sidebar, so keep the full menu (Account settings + Logout). */}
              <AccountMenu
                authUser={authUser}
                isAuthenticated={isAuthenticated}
                onOpenAccountSettings={onOpenAccountSettings}
                onLogout={onLogout}
                variant="avatar"
                className="md:hidden"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5">{brand}</div>
        )}
      </div>
    </header>
  );
}
