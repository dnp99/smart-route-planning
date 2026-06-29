import { NavLink } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";

// Strip variant: the standalone underline-tab row used below the header on mobile.
const stripTabClassName = (isActive) =>
  [
    "group flex items-center gap-2 border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
    isActive
      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
  ].join(" ");

// Header variant: inline nav inside the merged desktop header bar.
const headerTabClassName = (isActive) =>
  [
    "group flex items-center gap-2 border-b-2 pb-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
    isActive
      ? "border-blue-600 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
  ].join(" ");

const iconClassName = (isActive) =>
  [
    "h-4 w-4 shrink-0",
    isActive
      ? "text-blue-600 dark:text-blue-400"
      : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500",
  ].join(" ");

export default function AppTabs({ variant = "strip" }) {
  const isHeader = variant === "header";
  const tabClassName = ({ isActive }) =>
    isHeader ? headerTabClassName(isActive) : stripTabClassName(isActive);

  return (
    <nav className={isHeader ? responsiveStyles.navBarNav : responsiveStyles.tabNav}>
      <NavLink to="/home" end aria-label="Home" className={tabClassName}>
        {({ isActive }) => (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={iconClassName(isActive)}
            >
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10.5V20h13V10.5" />
              <path d="M10 20v-5h4v5" />
            </svg>
            Home
          </>
        )}
      </NavLink>
      <NavLink to="/clients" aria-label="Clients" className={tabClassName}>
        {({ isActive }) => (
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
              className={iconClassName(isActive)}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Clients
          </>
        )}
      </NavLink>
      <NavLink to="/route-planner" aria-label="Route Planner" className={tabClassName}>
        {({ isActive }) => (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={iconClassName(isActive)}
            >
              <circle cx="3" cy="6" r="2" />
              <circle cx="21" cy="6" r="2" />
              <circle cx="12" cy="18" r="2" />
              <path d="M5 6h6l4.5 6H21" />
              <path d="M3 6l4.5 6H12" />
              <path d="M12 16V8" />
            </svg>
            Route Planner
          </>
        )}
      </NavLink>
    </nav>
  );
}
