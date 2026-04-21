import { Link } from "react-router-dom";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "../../constants/support";

type LegalPageProps = {
  isModal?: boolean;
};

export default function TrademarkPage({ isModal = false }: LegalPageProps) {
  return (
    <main
      className={`${isModal ? "mt-3" : "mt-4"} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5`}
    >
      <h1 className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100">Trademark</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last updated: March 2026</p>

      <div className="mt-4 grid gap-4 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Routefy Trademark
          </h2>
          <p className="m-0">
            &ldquo;Routefy&rdquo; is a trademark of Routefy. All rights reserved. Unauthorized use
            of the Routefy name, logo, or any associated marks is prohibited without prior written
            consent.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Rights Reservation
          </h2>
          <p className="m-0">
            Routefy reserves all rights with respect to its trademarks, service marks, and trade
            names. Nothing in this application grants any license to use Routefy trademarks without
            express written permission.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">Contact</h2>
          <p className="m-0">
            For trademark questions, contact us at{" "}
            <a
              href={SUPPORT_EMAIL_MAILTO}
              className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      {!isModal && (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Link
            to="/"
            className="inline-flex items-center py-1 text-sm text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            &larr; Back to app
          </Link>
        </div>
      )}
    </main>
  );
}
