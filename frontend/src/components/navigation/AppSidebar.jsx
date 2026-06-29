import { Link } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import AppTabs from "./AppTabs";
import AccountMenu from "../layout/AccountMenu";
import { resolveTodayHoursDisplay } from "../home/todayHours";

// Desktop-only left rail (design 2a): brand, grouped nav, a Today card, and the
// account menu at the foot. Hidden below md, where the top header + strip take over.
export default function AppSidebar({ authUser, onOpenAccountSettings, onLogout }) {
  const workingHours = resolveTodayHoursDisplay(authUser?.workingHours);

  return (
    <aside className={responsiveStyles.sidebar}>
      <div className={responsiveStyles.sidebarBrandRow}>
        <Link to="/home" aria-label="Routefy home" className={responsiveStyles.sidebarBrand}>
          <span className={responsiveStyles.sidebarBrandTile} aria-hidden="true">
            <RoutefyBrandMark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </span>
          <span className={responsiveStyles.sidebarBrandWordmark}>Routefy</span>
        </Link>
      </div>

      <div className={responsiveStyles.sidebarBody}>
        <p className={responsiveStyles.sidebarSectionLabel}>Main</p>
        <AppTabs variant="sidebar" />

        <p className={`${responsiveStyles.sidebarSectionLabel} mt-5`}>Workspace</p>
        <button
          type="button"
          onClick={onOpenAccountSettings}
          className={responsiveStyles.sidebarNavButton}
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
            className="h-[18px] w-[18px] shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>

        <div className="flex-1" />

        <div className={responsiveStyles.sidebarTodayCard}>
          <p className={responsiveStyles.sidebarTodayLabel}>Today</p>
          <div className={responsiveStyles.sidebarTodayRow}>
            <span className={responsiveStyles.sidebarTodayKey}>Working hours</span>
            <span className={responsiveStyles.sidebarTodayValue}>{workingHours}</span>
          </div>
        </div>

        <AccountMenu
          authUser={authUser}
          isAuthenticated
          onOpenAccountSettings={onOpenAccountSettings}
          onLogout={onLogout}
          variant="card"
        />
      </div>
    </aside>
  );
}
