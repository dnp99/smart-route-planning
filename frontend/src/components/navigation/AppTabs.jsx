import { NavLink } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";

const resolveTabClassName = ({ isActive }) =>
  [
    "group flex items-center gap-2 border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
    isActive
      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
  ].join(" ");

export default function AppTabs() {
  return (
    <nav className={responsiveStyles.tabNav}>
      <NavLink to="/home" end aria-label="Home" className={resolveTabClassName}>
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
              className={[
                "h-4 w-4 shrink-0",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500",
              ].join(" ")}
            >
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10.5V20h13V10.5" />
              <path d="M10 20v-5h4v5" />
            </svg>
            Home
          </>
        )}
      </NavLink>
      <NavLink to="/clients" aria-label="Clients" className={resolveTabClassName}>
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
              className={[
                "h-4 w-4 shrink-0",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500",
              ].join(" ")}
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
      <NavLink to="/route-planner" aria-label="Route Planner" className={resolveTabClassName}>
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
              className={[
                "h-4 w-4 shrink-0",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500",
              ].join(" ")}
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
