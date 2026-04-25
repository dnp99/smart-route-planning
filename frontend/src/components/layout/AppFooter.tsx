import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import ContactUsModal from "../modals/ContactUsModal";

export default function AppFooter() {
  const location = useLocation();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <footer className={responsiveStyles.appFooter}>
      <div className={responsiveStyles.appFooterInner}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <RoutefyBrandMark className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
        <nav
          aria-label="Legal and support links"
          className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 sm:flex-nowrap sm:gap-x-3"
        >
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="py-1 text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Contact Us
          </button>
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
      <ContactUsModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </footer>
  );
}
