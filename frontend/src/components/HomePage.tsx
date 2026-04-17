import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AuthUser,
  DashboardAlert,
  DashboardSummaryResponse,
  DashboardTrendPoint,
  DashboardUpcomingStop,
  WeeklyWorkingHours,
} from "../../../shared/contracts";
import { fetchDashboardSummary } from "./home/homeDashboardService";
import { clearRoutePlannerDraft, readRoutePlannerDraft } from "./routePlanner/routePlannerDraft";
import { responsiveStyles } from "./responsiveStyles";

type HomePageProps = {
  isAuthenticated: boolean;
  authUser?: AuthUser | null;
  onOpenAccountSettings?: () => void;
};

const EMPTY_TREND: DashboardTrendPoint[] = [
  { date: "", label: "Mon", onTimeRatePercent: 0 },
  { date: "", label: "Tue", onTimeRatePercent: 0 },
  { date: "", label: "Wed", onTimeRatePercent: 0 },
  { date: "", label: "Thu", onTimeRatePercent: 0 },
  { date: "", label: "Fri", onTimeRatePercent: 0 },
  { date: "", label: "Sat", onTimeRatePercent: 0 },
  { date: "", label: "Sun", onTimeRatePercent: 0 },
];

const toAlertLabel = (level: DashboardAlert["level"]) => {
  if (level === "action_needed") return "Action needed";
  if (level === "at_risk") return "At risk";
  return "Heads up";
};

const toAlertTone = (level: DashboardAlert["level"]) => {
  if (level === "action_needed") {
    return "text-rose-600 dark:text-rose-300";
  }

  if (level === "at_risk") {
    return "text-amber-600 dark:text-amber-300";
  }

  return "text-sky-600 dark:text-sky-300";
};

const toStopStatusLabel = (status: DashboardUpcomingStop["status"]) => {
  if (status === "at_risk") return "At risk";
  if (status === "pending") return "Pending";
  return "On track";
};

const resolveOnTimeTone = (value: number | null) => {
  if (value === null) {
    return "text-slate-500";
  }

  if (value >= 90) {
    return "text-emerald-600";
  }

  if (value >= 75) {
    return "text-amber-600";
  }

  return "text-rose-600";
};

const resolveGreetingPrefix = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const resolveGreetingName = (displayName?: string | null) => {
  if (!displayName) {
    return "there";
  }

  const trimmed = displayName.trim();
  if (!trimmed) {
    return "there";
  }

  const [firstToken] = trimmed.split(/\s+/);
  return firstToken || "there";
};

const resolveTodayHoursDisplay = (workingHours?: WeeklyWorkingHours | null) => {
  if (!workingHours) {
    return "—";
  }

  const dayKey = new Date()
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase() as keyof WeeklyWorkingHours;
  const daySchedule = workingHours[dayKey];

  if (!daySchedule?.enabled) {
    return "Off today";
  }

  return `${daySchedule.start} - ${daySchedule.end}`;
};

const resolveDraftDateLabel = (planningDate?: string) => {
  if (!planningDate) {
    return "upcoming date";
  }

  const parsedDate = new Date(planningDate);
  if (isNaN(parsedDate.getTime())) {
    return "upcoming date";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function HomePage({
  isAuthenticated,
  authUser = null,
  onOpenAccountSettings,
}: HomePageProps) {
  const navigate = useNavigate();
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryResponse | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboardSummary(null);
      setDashboardError("");
      setIsDashboardLoading(false);
      return;
    }

    let active = true;
    setIsDashboardLoading(true);

    void fetchDashboardSummary()
      .then((summary) => {
        if (!active) {
          return;
        }

        setDashboardSummary(summary);
        setDashboardError("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard.");
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setIsDashboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, dashboardRefreshKey]);

  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  }).format(new Date());

  const kpis = useMemo(() => {
    if (!dashboardSummary) {
      return [
        {
          label: "Routes today",
          value: "—",
          delta: "Run your first optimization",
          tone: "text-slate-500",
        },
        {
          label: "On-time rate (7d)",
          value: "—",
          delta: "Needs route history",
          tone: "text-slate-500",
        },
        {
          label: "Scheduled visits",
          value: "—",
          delta: "Today",
          tone: "text-blue-600",
        },
        {
          label: "Drive hours",
          value: "—",
          delta: "Today",
          tone: "text-slate-500",
        },
      ];
    }

    const onTimeRate = dashboardSummary.kpis.onTimeRatePercent7d;

    return [
      {
        label: "Routes today",
        value: String(dashboardSummary.kpis.routesToday),
        delta: `${dashboardSummary.kpis.visitsScheduledToday} visits planned`,
        tone: "text-blue-600",
      },
      {
        label: "On-time rate (7d)",
        value: onTimeRate === null ? "—" : `${onTimeRate}%`,
        delta: onTimeRate === null ? "No 7-day history" : "Weighted by scheduled visits",
        tone: resolveOnTimeTone(onTimeRate),
      },
      {
        label: "Unscheduled visits",
        value: String(dashboardSummary.kpis.unscheduledVisitsToday),
        delta: "Today",
        tone:
          dashboardSummary.kpis.unscheduledVisitsToday > 0 ? "text-amber-600" : "text-emerald-600",
      },
      {
        label: "Drive hours",
        value: `${dashboardSummary.kpis.driveHoursToday.toFixed(1)}h`,
        delta: "Today",
        tone: "text-emerald-600",
      },
    ];
  }, [dashboardSummary]);

  const alerts = useMemo(() => {
    const nextAlerts = dashboardSummary?.alerts ?? [];

    if (dashboardError && !dashboardSummary) {
      return [
        {
          title: "Dashboard unavailable",
          detail: dashboardError,
          level: "heads_up",
        } satisfies DashboardAlert,
      ];
    }

    if (dashboardError && dashboardSummary) {
      return [
        {
          title: "Dashboard refresh failed",
          detail: `Showing your last loaded snapshot. ${dashboardError}`,
          level: "heads_up",
        } satisfies DashboardAlert,
        ...nextAlerts,
      ].slice(0, 3);
    }

    if (nextAlerts.length === 0) {
      return [
        {
          title: "No route alerts",
          detail: "Optimize a route to generate actionable alerts.",
          level: "heads_up",
        } satisfies DashboardAlert,
      ];
    }

    return nextAlerts;
  }, [dashboardError, dashboardSummary]);

  const upcomingStops = dashboardSummary?.upcomingStops ?? [];
  const trendBars =
    dashboardSummary && dashboardSummary.trend.length > 0 ? dashboardSummary.trend : EMPTY_TREND;
  const routePlannerDraft = useMemo(() => readRoutePlannerDraft(), []);
  const draftSelectedCount = useMemo(
    () =>
      routePlannerDraft?.selectedDestinationStates.filter((destination) => destination.isIncluded)
        .length ?? 0,
    [routePlannerDraft],
  );
  const hasRouteDraft = draftSelectedCount > 0;
  const profileNudges = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const nudges: Array<{ id: string; message: string }> = [];

    if (!authUser?.homeAddress) {
      nudges.push({
        id: "home-address",
        message: "Add a home address for default start and end points.",
      });
    }

    if (!authUser?.workingHours) {
      nudges.push({
        id: "working-hours",
        message: "Set up working hours so today's schedule appears automatically.",
      });
    }

    return nudges;
  }, [authUser?.homeAddress, authUser?.workingHours, isAuthenticated]);
  const greetingName = resolveGreetingName(authUser?.displayName);
  const greetingPrefix = resolveGreetingPrefix();
  const todayHoursDisplay = resolveTodayHoursDisplay(authUser?.workingHours);

  const renderAuthenticatedActions = () => (
    <>
      <Link to="/patients" className={responsiveStyles.primaryButton}>
        Go to Clients
      </Link>
      <Link to="/route-planner" className={responsiveStyles.secondaryButton}>
        Open Route Planner
      </Link>
    </>
  );

  const renderSignedOutActions = () => (
    <>
      <Link to="/login" className={responsiveStyles.primaryButton}>
        Sign in to CareFlow
      </Link>
      <Link to="/legal/terms" className={responsiveStyles.secondaryButton}>
        Review terms
      </Link>
    </>
  );

  return (
    <main className="mt-3 grid gap-4 sm:gap-5">
      <section className={responsiveStyles.dashboardHeroSection}>
        <div
          aria-hidden="true"
          className="dashboard-grid-bg pointer-events-none absolute inset-0 opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-cyan-100/80 blur-2xl dark:bg-cyan-900/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-24 h-48 w-48 rounded-full bg-orange-100/70 blur-2xl dark:bg-orange-900/20"
        />
        <div className="relative max-w-2xl">
          <p className={responsiveStyles.dashboardEyebrow}>CareFlow Mission Control</p>
          <h1 className={responsiveStyles.dashboardHeroHeading}>
            {greetingPrefix}, {greetingName}
          </h1>
          <p className={responsiveStyles.dashboardHeroMeta}>{currentDateLabel}</p>
          <p className={responsiveStyles.dashboardHeroMeta}>
            Working hours today: {todayHoursDisplay}
          </p>
          <p className={responsiveStyles.dashboardHeroBody}>
            Track operations in one place, spot delays early, and launch route updates with fewer
            clicks.
          </p>
          <div className={responsiveStyles.dashboardHeroActions}>
            {isAuthenticated ? renderAuthenticatedActions() : renderSignedOutActions()}
          </div>
        </div>
      </section>

      {isAuthenticated && (dashboardError || isDashboardLoading) && (
        <section
          className={
            dashboardError
              ? "dashboard-reveal rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900/70 dark:bg-rose-950/30 sm:p-5"
              : responsiveStyles.dashboardCard
          }
        >
          <h2 className={responsiveStyles.cardTitle}>
            {dashboardError ? "Dashboard data unavailable" : "Refreshing dashboard"}
          </h2>
          <p className={`${responsiveStyles.cardDescription} mt-2`}>
            {dashboardError
              ? dashboardSummary
                ? "Your last successful dashboard snapshot is still displayed."
                : "No dashboard snapshot is available yet."
              : "Loading the latest route metrics..."}
          </p>
          {dashboardError && (
            <div className={responsiveStyles.dashboardDraftActions}>
              <button
                type="button"
                className={responsiveStyles.secondaryButton}
                onClick={() => setDashboardRefreshKey((value) => value + 1)}
              >
                Retry Dashboard
              </button>
            </div>
          )}
        </section>
      )}

      <section className={responsiveStyles.dashboardKpiGrid}>
        {kpis.map((kpi) => (
          <article key={kpi.label} className={responsiveStyles.dashboardKpiCard}>
            <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
            <p className={responsiveStyles.dashboardKpiValue}>{kpi.value}</p>
            <p className={`${responsiveStyles.dashboardKpiDelta} ${kpi.tone}`}>{kpi.delta}</p>
          </article>
        ))}
      </section>

      <section className={responsiveStyles.dashboardCard}>
        {hasRouteDraft ? (
          <>
            <h2 className={responsiveStyles.cardTitle}>Route Draft</h2>
            <p className={responsiveStyles.cardDescription}>
              Planning for {resolveDraftDateLabel(routePlannerDraft?.planningDate)} ·{" "}
              {draftSelectedCount} client{draftSelectedCount === 1 ? "" : "s"}
              {routePlannerDraft?.startAddress ? ` · Start: ${routePlannerDraft.startAddress}` : ""}
            </p>
            <div className={responsiveStyles.dashboardDraftActions}>
              <Link to="/route-planner" className={responsiveStyles.primaryButton}>
                Resume Planning
              </Link>
              <button
                type="button"
                className={responsiveStyles.secondaryButton}
                onClick={() => {
                  clearRoutePlannerDraft();
                  navigate("/route-planner");
                }}
              >
                Start Fresh
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={responsiveStyles.cardTitle}>No route draft yet</h2>
            <p className={responsiveStyles.cardDescription}>
              Build your next route for today or an upcoming visit day.
            </p>
            <div className={responsiveStyles.dashboardDraftActions}>
              <Link to="/route-planner" className={responsiveStyles.primaryButton}>
                Plan a Route
              </Link>
            </div>
          </>
        )}
      </section>

      {profileNudges.map((nudge) => (
        <section key={nudge.id} className={responsiveStyles.dashboardNudgeCard}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className={responsiveStyles.cardDescription}>⚠ {nudge.message}</p>
            <button
              type="button"
              className={responsiveStyles.warningBannerButton}
              onClick={() => onOpenAccountSettings?.()}
            >
              Open Settings
            </button>
          </div>
        </section>
      ))}

      <section className={responsiveStyles.dashboardCard}>
        <h2 className={responsiveStyles.cardTitle}>Route Alerts</h2>
        <ul className="m-0 mt-4 list-none space-y-3 p-0">
          {alerts.map((alert) => (
            <li
              key={`${alert.title}-${alert.detail}`}
              className={responsiveStyles.dashboardAlertItem}
            >
              <p className={responsiveStyles.cardTitle}>{alert.title}</p>
              <p className={responsiveStyles.cardDescription}>{alert.detail}</p>
              <p
                className={`${responsiveStyles.dashboardKpiDelta} uppercase tracking-wide ${toAlertTone(alert.level)}`}
              >
                {toAlertLabel(alert.level)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="dashboard-reveal grid gap-4 xl:grid-cols-12">
        <article className={`${responsiveStyles.dashboardCard} xl:col-span-5`}>
          <h2 className={responsiveStyles.cardTitle}>Today&apos;s Schedule</h2>
          {upcomingStops.length === 0 ? (
            <p
              className={`${responsiveStyles.cardDescription} mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700`}
            >
              No upcoming stops yet. Optimize a route to populate this view.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-2 p-0">
              {upcomingStops.map((stop) => (
                <li
                  key={`${stop.route}-${stop.time}-${stop.destination}`}
                  className={responsiveStyles.dashboardScheduleItem}
                >
                  <div>
                    <p className={responsiveStyles.cardTitle}>
                      {stop.time} · {stop.patientName || "Client"}
                    </p>
                    <p className={responsiveStyles.cardDescription}>{stop.destination}</p>
                  </div>
                  <span className={responsiveStyles.dashboardStatusPill}>
                    {toStopStatusLabel(stop.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={`${responsiveStyles.dashboardCard} xl:col-span-4`}>
          <h2 className={responsiveStyles.cardTitle}>Weekly On-time Trend</h2>
          <p className={responsiveStyles.cardDescription}>
            Weighted on-time percentage over the last 7 planning days.
          </p>
          <ul className="m-0 mt-4 list-none space-y-2 p-0">
            {trendBars.map((day) => (
              <li key={`${day.label}-${day.date}`} className={responsiveStyles.dashboardTrendRow}>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {day.label}
                </span>
                <div className={responsiveStyles.dashboardTrendTrack}>
                  <div
                    className={responsiveStyles.dashboardTrendFill}
                    style={{ width: `${Math.max(0, Math.min(100, day.onTimeRatePercent))}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {Math.round(day.onTimeRatePercent)}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className={`${responsiveStyles.dashboardCard} xl:col-span-3`}>
          <h2 className={responsiveStyles.cardTitle}>Quick Actions</h2>
          <div className="mt-4 grid gap-2">
            <Link to="/route-planner" className={responsiveStyles.primaryButton}>
              Plan New Route
            </Link>
            <Link to="/patients" className={responsiveStyles.secondaryButton}>
              Add Client
            </Link>
          </div>
        </article>
      </section>

      <section className={responsiveStyles.dashboardCard}>
        <h2 className={responsiveStyles.cardTitle}>End-of-day Snapshot</h2>
        <div className={responsiveStyles.dashboardSnapshotGrid}>
          <p className={responsiveStyles.dashboardSnapshotItem}>
            Completed routes:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {dashboardSummary ? dashboardSummary.snapshot.completedRoutes : "—"}
            </strong>
          </p>
          <p className={responsiveStyles.dashboardSnapshotItem}>
            Delayed routes:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {dashboardSummary ? dashboardSummary.snapshot.delayedRoutes : "—"}
            </strong>
          </p>
          <p className={responsiveStyles.dashboardSnapshotItem}>
            Distance planned:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {dashboardSummary
                ? `${dashboardSummary.snapshot.totalDistanceKm.toFixed(1)} km`
                : "—"}
            </strong>
          </p>
        </div>
      </section>
    </main>
  );
}
