import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <main className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h1 className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100">Terms of Use</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last updated: March 2026</p>

      <div className="mt-4 grid gap-4 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Intended Use
          </h2>
          <p className="m-0">
            CareFlow is a nurse operations tool designed to help healthcare professionals manage
            patient visits and plan daily routes. Use of this application is intended solely for
            authorized personnel in connection with their professional duties.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Account Responsibilities
          </h2>
          <p className="m-0">
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activity that occurs under your account. You must notify us immediately of any
            unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Availability Disclaimer
          </h2>
          <p className="m-0">
            CareFlow is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We
            do not guarantee uninterrupted or error-free access and reserve the right to modify or
            discontinue the service at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">Contact</h2>
          <p className="m-0">
            For questions about these terms, contact us at{" "}
            <a
              href="mailto:dpatel1995@yahoo.com"
              className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              dpatel1995@yahoo.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Link
          to="/"
          className="inline-flex items-center py-1 text-sm text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          &larr; Back to app
        </Link>
      </div>
    </main>
  );
}
