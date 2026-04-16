import { Link } from "react-router-dom";

type HomePageProps = {
  isAuthenticated: boolean;
};

const featureHighlights = [
  {
    title: "Client-first scheduling",
    description:
      "Keep your client list organized and ready so each day starts with clear priorities.",
  },
  {
    title: "Smart route optimization",
    description:
      "Build efficient daily routes with fewer delays and more predictable arrival windows.",
  },
  {
    title: "Workflow built for field teams",
    description:
      "Move from planning to dispatch quickly with tools that support mobile service operations.",
  },
];

export default function HomePage({ isAuthenticated }: HomePageProps) {
  return (
    <main className="mt-3 grid gap-4 sm:gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-100/70 blur-2xl dark:bg-blue-900/20"
        />
        <div className="relative max-w-2xl">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
            CareFlow
          </p>
          <h1 className="m-0 mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Plan daily visits without the route chaos.
          </h1>
          <p className="m-0 mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            CareFlow helps teams organize clients, optimize daily travel, and keep operations
            running with confidence.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {isAuthenticated ? (
              <>
                <Link
                  to="/patients"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Go to Clients
                </Link>
                <Link
                  to="/route-planner"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Open Route Planner
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Sign in to CareFlow
                </Link>
                <Link
                  to="/legal/terms"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Review terms
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {featureHighlights.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <h2 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
              {feature.title}
            </h2>
            <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
