import { Link, useNavigate } from "react-router-dom";

type LandingPageProps = {
  isAuthenticated: boolean;
  authUser?: {
    displayName?: string | null;
    workingHours?: { start?: string | null; end?: string | null } | null;
  } | null;
  onOpenAccountSettings?: () => void;
};

function LandingPage({ isAuthenticated, authUser, onOpenAccountSettings }: LandingPageProps) {
  const navigate = useNavigate();

  if (isAuthenticated) {
    const displayName = authUser?.displayName?.trim() || "there";
    const start = authUser?.workingHours?.start;
    const end = authUser?.workingHours?.end;

    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,1)_100%)] px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">
              Routefy mission control
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Good evening, {displayName}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Track operations in one place, spot delays early, and launch route updates with fewer
              clicks.
            </p>

            {(start || end) && (
              <div className="mt-6 inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800">
                Working hours today: {start ?? "--:--"} - {end ?? "--:--"}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/clients")}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Go to Clients
              </button>
              <button
                type="button"
                onClick={() => navigate("/route-planner")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Route Planner
              </button>
              <button
                type="button"
                onClick={onOpenAccountSettings}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Account settings
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">Routefy</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Organize clients and plan better daily routes.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Routefy helps small teams keep client information organized, reduce manual planning, and
            stay on top of daily visits.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-blue-100 blur-3xl" />
          <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-cyan-50 to-white p-5 text-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Today's routes
              </p>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                Optimized
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-blue-100 bg-white/85 p-4">
              <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">11 visits</span>
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700">
                  42 km planned
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  92% on-time
                </span>
              </div>

              <div className="relative mt-4 h-44 overflow-hidden rounded-xl border border-blue-100 bg-[radial-gradient(circle_at_20%_20%,rgba(191,219,254,0.35),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(165,243,252,0.3),transparent_36%),linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]">
                <svg
                  viewBox="0 0 100 60"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full"
                >
                  <path
                    d="M10 45 C 20 30, 30 30, 40 40 C 48 48, 58 46, 66 35 C 72 27, 82 22, 92 16"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray="1 0"
                  />
                  <path
                    d="M8 18 C 18 24, 28 23, 37 16 C 48 8, 60 11, 72 20"
                    fill="none"
                    stroke="#93c5fd"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute left-[12%] top-[66%] h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" />
                <span className="absolute left-[36%] top-[60%] h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" />
                <span className="absolute left-[63%] top-[50%] h-3 w-3 rounded-full border-2 border-white bg-cyan-500 shadow" />
                <span className="absolute left-[88%] top-[30%] h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Client organization</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep addresses, visit details, and client information together in one place.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Route planning</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Build more efficient daily routes without relying on messy manual planning.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Daily clarity</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reduce coordination overhead and keep the day easier to manage.
          </p>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
