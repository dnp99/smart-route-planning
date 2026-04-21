import { Link, useLocation } from "react-router-dom";
import { SUPPORT_EMAIL_MAILTO } from "../../constants/support";
import { responsiveStyles } from "../responsiveStyles";

export default function AppFooter() {
  const location = useLocation();

  return (
    <footer className={responsiveStyles.appFooter}>
      <div className={responsiveStyles.appFooterInner}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 text-blue-600 dark:text-blue-400"
            >
              <path d="M1 12 L5 12 L7 5 L9 19 L11 12 L13 12" />
              <path d="M19 5C16.8 5 15 6.8 15 9C15 11.8 19 17 19 17C19 17 23 11.8 23 9C23 6.8 21.2 5 19 5Z" />
              <circle cx="19" cy="9" r="1.8" fill="currentColor" strokeWidth="0" />
            </svg>
          </div>
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              Routefy
            </p>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              &copy; {new Date().getFullYear()} Routefy. All rights reserved.
            </p>
          </div>
        </div>
        <nav aria-label="Legal and support links" className="flex flex-wrap gap-x-3 gap-y-0">
          <a
            href={SUPPORT_EMAIL_MAILTO}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Contact Us
          </a>
          <Link
            to="/legal/terms"
            state={{ backgroundLocation: location }}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Terms
          </Link>
          <Link
            to="/legal/privacy"
            state={{ backgroundLocation: location }}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Privacy
          </Link>
          <Link
            to="/legal/license"
            state={{ backgroundLocation: location }}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            License
          </Link>
          <Link
            to="/legal/trademark"
            state={{ backgroundLocation: location }}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Trademark
          </Link>
        </nav>
      </div>
    </footer>
  );
}
