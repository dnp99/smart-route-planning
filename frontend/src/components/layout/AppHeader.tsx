import { Link, useLocation } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import AccountMenu from "./AccountMenu";

type AuthUser = {
  displayName?: string;
  email?: string;
  homeAddress?: string;
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
              <button
                type="button"
                aria-label="Notifications"
                className={`${responsiveStyles.topBarIconButton} hidden md:inline-flex`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
              </button>
              {/* Desktop account/settings live entirely in the sidebar (identity
                  card + Settings row), so the top bar has no avatar there. Mobile
                  has no sidebar, so it keeps the full avatar menu below. */}
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
