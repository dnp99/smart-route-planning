import { Link } from "react-router-dom";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "../../constants/support";

type LegalPageProps = {
  isModal?: boolean;
};

export default function LicensePage({ isModal = false }: LegalPageProps) {
  return (
    <main
      className={`${isModal ? "mt-3" : "mt-4"} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5`}
    >
      <h1 className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100">License</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last updated: March 2026</p>

      <div className="mt-4 grid gap-4 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            1. Application License
          </h2>
          <p className="m-0">Routefy is proprietary software. All rights are reserved.</p>
          <p className="m-0 mt-2">
            You are granted a limited, non-exclusive, non-transferable right to use the application
            for its intended purpose.
          </p>
          <p className="m-0 mt-2">You may not:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Copy, modify, or distribute the software</li>
            <li>Reverse engineer or attempt to extract source code</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            2. Third-Party Software
          </h2>
          <p className="m-0">Routefy includes and depends on third-party open-source libraries.</p>
          <p className="m-0 mt-2">
            These libraries remain the property of their respective authors and are used under their
            respective licenses (such as MIT, Apache 2.0, and others).
          </p>
          <p className="m-0 mt-2">
            Use of Routefy does not grant you rights to these third-party components beyond what is
            provided in their licenses.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            3. Third-Party Services
          </h2>
          <p className="m-0">Routefy uses external services, including:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Google Maps / Places APIs</li>
            <li>Cloud hosting providers</li>
          </ul>
          <p className="m-0 mt-2">
            These services are governed by their own terms and privacy policies.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            4. Disclaimer
          </h2>
          <p className="m-0">
            Routefy is provided &ldquo;as is&rdquo; without warranties of any kind.
          </p>
          <p className="m-0 mt-2">We do not guarantee:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>uninterrupted service</li>
            <li>accuracy of route planning results</li>
          </ul>
          <p className="m-0 mt-2">
            Users remain responsible for verifying schedules and decisions.
          </p>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">
            5. Limitation of Liability
          </h2>
          <p className="m-0">To the maximum extent permitted by law, Routefy is not liable for:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>indirect or consequential damages</li>
            <li>loss of data or operational disruptions</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200">6. Contact</h2>
          <p className="m-0">For licensing inquiries:</p>
          <p className="m-0 mt-2 font-semibold">Routefy Support</p>
          <p className="m-0">
            <a
              href={SUPPORT_EMAIL_MAILTO}
              className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {SUPPORT_EMAIL}
            </a>
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
