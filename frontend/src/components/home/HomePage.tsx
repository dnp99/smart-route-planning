import { useEffect, useMemo, useState } from "react";
import CarFlyAnimation from "../shared/CarFlyAnimation";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type {
  AuthUser,
  DashboardBusiestDay,
  DashboardPatientRisk,
  DashboardSummaryResponse,
  DashboardTrendPoint,
  DashboardUpcomingStop,
  WeeklyWorkingHours,
} from "../../../../shared/contracts";
import { fetchDashboardSummary, fetchRouteRunsForPlanningDate } from "./homeDashboardService";
import {
  clearRoutePlannerDraft,
  readRoutePlannerDraft,
} from "../../features/route-planner/state/routePlannerDraft";
import { responsiveStyles } from "../responsiveStyles";
import RouteRunPickerModal, { type RouteRunPickerItem } from "../modals/RouteRunPickerModal";

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

const toStopStatusLabel = (status: DashboardUpcomingStop["status"]) => {
  if (status === "at_risk") return "At risk";
  if (status === "pending") return "Pending";
  return "On track";
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

const resolveTodayPlanningDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolvePlanningDateDisplay = (planningDate: string) => {
  const parsedDate = new Date(`${planningDate}T00:00:00`);
  if (isNaN(parsedDate.getTime())) {
    return planningDate;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const resolveLastUpdatedLabel = (summary: DashboardSummaryResponse | null) => {
  if (!summary?.asOf) {
    return null;
  }

  const parsed = new Date(summary.asOf);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  const timezone = summary.timezone && summary.timezone.trim() ? summary.timezone : undefined;
  return parsed.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  });
};

export default function HomePage({
  isAuthenticated,
  authUser = null,
  onOpenAccountSettings,
}: HomePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryResponse | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [isRunPickerOpen, setIsRunPickerOpen] = useState(false);
  const [routeRuns, setRouteRuns] = useState<RouteRunPickerItem[]>([]);
  const [selectedRouteRunId, setSelectedRouteRunId] = useState<string | null>(null);
  const [routeRunsError, setRouteRunsError] = useState("");
  const [isRouteRunsLoading, setIsRouteRunsLoading] = useState(false);
  const [isOpeningRouteRun, setIsOpeningRouteRun] = useState(false);

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
          trend: "No baseline yet",
          href: "/route-planner",
        },
        {
          label: "Unscheduled visits",
          value: "—",
          delta: "Today",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/route-planner",
        },
        {
          label: "Drive hours",
          value: "—",
          delta: "Last 7 days",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/route-planner",
        },
        {
          label: "Total distance",
          value: "—",
          delta: "Today",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/route-planner",
        },
        {
          label: "On-time rate",
          value: "—",
          delta: "Last 7 days",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/route-planner",
        },
        {
          label: "Active clients",
          value: "—",
          delta: "All time",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/clients",
        },
        {
          label: "Template coverage",
          value: "—",
          delta: "No active clients yet",
          tone: "text-blue-600",
          trend: "No baseline yet",
          href: "/clients?templateFilter=without",
          progressPercent: 0,
        },
        {
          label: "Inactive clients",
          value: "—",
          delta: "Not used in 30+ days",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/clients",
        },
      ];
    }

    const activePatientCount = dashboardSummary.kpis.activePatientCount;
    const templatedActivePatientCount = dashboardSummary.kpis.templatedActivePatientCount;
    const activePatientsWithoutTemplateCount = Math.max(
      0,
      activePatientCount - templatedActivePatientCount,
    );
    const templateCoveragePercent =
      activePatientCount > 0
        ? Math.round((templatedActivePatientCount / activePatientCount) * 100)
        : 0;

    return [
      {
        label: "Routes today",
        value: String(dashboardSummary.kpis.routesToday),
        delta: `${dashboardSummary.kpis.visitsScheduledToday} visits planned`,
        tone: "text-blue-600",
        trend:
          dashboardSummary.kpis.routesToday > 0 ? "Live routing activity" : "No routes run yet",
        href: "/route-planner",
      },
      {
        label: "Active clients",
        value: String(dashboardSummary.kpis.activePatientCount),
        delta: "All time",
        tone: "text-blue-600",
        trend:
          dashboardSummary.kpis.activePatientCount > 0 ? "Roster in use" : "No active clients yet",
        href: "/clients",
      },
      {
        label: "Inactive clients",
        value: String(dashboardSummary.kpis.staleClientsCount),
        delta: "Not used in 30+ days",
        tone: dashboardSummary.kpis.staleClientsCount > 0 ? "text-amber-600" : "text-slate-500",
        trend:
          dashboardSummary.kpis.staleClientsCount > 0
            ? "Review & archive →"
            : "All clients recently used",
        href: dashboardSummary.kpis.staleClientsCount > 0 ? "/clients?review=stale" : "/clients",
      },
      {
        label: "Template coverage",
        value: `${templatedActivePatientCount} / ${activePatientCount} clients`,
        delta:
          activePatientCount > 0 ? `${templateCoveragePercent}% covered` : "No active clients yet",
        tone: templateCoveragePercent >= 60 ? "text-emerald-600" : "text-amber-600",
        trend:
          activePatientsWithoutTemplateCount > 0
            ? `${activePatientsWithoutTemplateCount} clients without templates`
            : "All active clients covered",
        href:
          activePatientsWithoutTemplateCount > 0 ? "/clients?templateFilter=without" : "/clients",
        progressPercent: templateCoveragePercent,
      },
      {
        label: "Visits this week",
        value: String(dashboardSummary.kpis.visitsScheduledLast7Days),
        delta: "Last 7 days",
        tone:
          dashboardSummary.kpis.visitsScheduledLast7Days > 0 ? "text-blue-600" : "text-slate-500",
        trend:
          dashboardSummary.kpis.visitsScheduledLast7Days > 0
            ? "Scheduled across all routes"
            : "No visits scheduled yet",
        href: "/route-planner",
      },
      {
        label: "On-time rate",
        value:
          dashboardSummary.kpis.onTimeRatePercent7d === null
            ? "—"
            : `${dashboardSummary.kpis.onTimeRatePercent7d}%`,
        delta: "Last 7 days",
        tone:
          dashboardSummary.kpis.onTimeRatePercent7d === null
            ? "text-slate-500"
            : dashboardSummary.kpis.onTimeRatePercent7d >= 90
              ? "text-emerald-600"
              : dashboardSummary.kpis.onTimeRatePercent7d >= 75
                ? "text-amber-600"
                : "text-rose-600",
        trend:
          dashboardSummary.kpis.onTimeRatePercent7d === null
            ? "No route history yet"
            : dashboardSummary.kpis.onTimeRatePercent7d >= 90
              ? "Consistent on-time performance"
              : "Timing risk needs attention",
        href: "/route-planner",
      },
      {
        label: "Drive hours",
        value: `${dashboardSummary.kpis.driveHoursLast7Days.toFixed(1)}h`,
        delta: "Last 7 days",
        tone: "text-emerald-600",
        trend:
          dashboardSummary.kpis.driveHoursLast7Days > 0
            ? "Field time recorded"
            : "No drive time yet",
        href: "/route-planner",
      },
      {
        label: "Total distance",
        value: `${dashboardSummary.kpis.totalDistanceKm7d.toFixed(1)} km`,
        delta: "Last 7 days",
        tone: dashboardSummary.kpis.totalDistanceKm7d > 0 ? "text-blue-600" : "text-slate-500",
        trend:
          dashboardSummary.kpis.totalDistanceKm7d > 0
            ? "Distance covered across recent routes"
            : "No distance recorded yet",
        href: "/route-planner",
      },
    ];
  }, [dashboardSummary]);

  const upcomingStops = dashboardSummary?.upcomingStops ?? [];
  const trendBars =
    dashboardSummary && dashboardSummary.trend.length > 0 ? dashboardSummary.trend : EMPTY_TREND;
  const busiestDays: DashboardBusiestDay[] = dashboardSummary?.busiestDays ?? [];
  const patientRisks: DashboardPatientRisk[] = dashboardSummary?.patientRisks ?? [];
  const maxBusiestAvg = useMemo(
    () => Math.max(1, ...busiestDays.map((d) => d.avgVisits)),
    [busiestDays],
  );
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

    const setupMissing = authUser?.setupMissing ?? [];
    const nudges: Array<{
      id: string;
      message: string;
      rationale: string;
      action: "setup" | "settings" | "templates";
      tone: "warning" | "info";
    }> = [];

    if (setupMissing.indexOf("displayName") >= 0) {
      nudges.push({
        id: "display-name",
        message: "Add a display name to complete workspace setup.",
        rationale: "Needed for profile identification across your workspace.",
        action: "setup",
        tone: "warning",
      });
    }

    if (setupMissing.indexOf("workingHours") >= 0) {
      nudges.push({
        id: "working-hours",
        message: "Set up working hours to complete workspace setup.",
        rationale: "Needed to keep route feasibility and workday timing accurate.",
        action: "setup",
        tone: "warning",
      });
    }

    if (setupMissing.indexOf("optimizationObjective") >= 0) {
      nudges.push({
        id: "optimization-objective",
        message: "Choose route priority (time or distance) to complete setup.",
        rationale: "Needed so route optimization uses your preferred planning strategy.",
        action: "setup",
        tone: "warning",
      });
    }

    if (!authUser?.homeAddress) {
      nudges.push({
        id: "home-address-optional",
        message: "Add a home address for default start and end points.",
        rationale: "Needed so route optimization starts and ends from your base automatically.",
        action: "settings",
        tone: "warning",
      });
    }

    const activePatientCount = dashboardSummary?.kpis.activePatientCount ?? 0;
    const templatedActivePatientCount = dashboardSummary?.kpis.templatedActivePatientCount ?? 0;
    if (activePatientCount > 0) {
      const coveragePercent = Math.round((templatedActivePatientCount / activePatientCount) * 100);
      const clientsWithoutTemplates = Math.max(0, activePatientCount - templatedActivePatientCount);
      if (clientsWithoutTemplates > 0) {
        nudges.push({
          id: "template-coverage",
          message: `${clientsWithoutTemplates} clients are missing recurring templates.`,
          rationale:
            "Set templates for frequent clients to cut daily manual selection and keep route planning faster.",
          action: "templates",
          tone: coveragePercent < 60 ? "warning" : "info",
        });
      }
    }

    return nudges;
  }, [authUser?.homeAddress, authUser?.setupMissing, dashboardSummary, isAuthenticated]);
  const [dismissedNudgeIds, setDismissedNudgeIds] = useState<string[]>([]);
  const visibleNudges = useMemo(
    () => profileNudges.filter((nudge) => dismissedNudgeIds.indexOf(nudge.id) < 0),
    [dismissedNudgeIds, profileNudges],
  );
  const greetingName = resolveGreetingName(authUser?.displayName);
  const greetingPrefix = resolveGreetingPrefix();
  const todayHoursDisplay = resolveTodayHoursDisplay(authUser?.workingHours);
  const lastUpdatedLabel = resolveLastUpdatedLabel(dashboardSummary);
  const todayPlanningDate = resolveTodayPlanningDate();
  const todayPlanningDateLabel = resolvePlanningDateDisplay(todayPlanningDate);

  const openRouteRun = (runId: string, planningDate: string) => {
    setIsOpeningRouteRun(true);
    navigate("/route-planner", {
      state: {
        savedRouteRunId: runId,
        planningDate,
      },
    });
  };

  const handleRoutesTodayClick = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    setIsRouteRunsLoading(true);
    setRouteRunsError("");

    try {
      const runs = await fetchRouteRunsForPlanningDate(todayPlanningDate);
      const v3Runs = runs.filter((run) => run.endpointVersion === "v3");

      if (v3Runs.length === 0) {
        navigate("/route-planner");
        return;
      }

      if (v3Runs.length === 1) {
        openRouteRun(v3Runs[0].id, todayPlanningDate);
        return;
      }

      const mappedRuns: RouteRunPickerItem[] = v3Runs.map((run) => ({
        id: run.id,
        createdAt: run.createdAt,
        optimizationObjective: run.optimizationObjective,
        scheduledVisitCount: run.scheduledVisitCount,
        unscheduledVisitCount: run.unscheduledVisitCount,
        algorithmVersion: run.algorithmVersion,
      }));

      const sortedRuns = [...mappedRuns].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      setRouteRuns(sortedRuns);
      setSelectedRouteRunId(sortedRuns[0]?.id ?? null);
      setIsRunPickerOpen(true);
    } catch (error) {
      setRouteRuns([]);
      setSelectedRouteRunId(null);
      setRouteRunsError(error instanceof Error ? error.message : "Unable to load saved routes.");
      setIsRunPickerOpen(true);
    } finally {
      setIsRouteRunsLoading(false);
    }
  };

  const handlePlanMyDayClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    clearRoutePlannerDraft();
    navigate("/route-planner", { state: { autoOptimizeToday: true } });
  };

  const renderAuthenticatedActions = () => (
    <>
      <button
        type="button"
        className={responsiveStyles.primaryButton}
        onClick={handlePlanMyDayClick}
      >
        Plan my day
      </button>
      <Link to="/clients" className={responsiveStyles.secondaryButton}>
        Go to Clients
      </Link>
    </>
  );

  const renderSignedOutActions = () => (
    <>
      <Link to="/login" className={responsiveStyles.primaryButton}>
        Sign in to Routefy
      </Link>
      <Link
        to="/legal/terms"
        state={{ backgroundLocation: location }}
        className={responsiveStyles.secondaryButton}
      >
        Review terms
      </Link>
    </>
  );

  return (
    <main className="mt-3 grid gap-4 sm:gap-5">
      <section className={responsiveStyles.dashboardHeroSection}>
        <div
          aria-hidden="true"
          className="dashboard-grid-bg pointer-events-none absolute inset-0 opacity-35"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-cyan-100/80 blur-2xl dark:bg-cyan-900/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-24 h-48 w-48 rounded-full bg-orange-100/70 blur-2xl dark:bg-orange-900/20"
        />
        <div className="relative max-w-[48rem]">
          <p className={`${responsiveStyles.dashboardEyebrow} opacity-85`}>
            Routefy Mission Control
          </p>
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

      {visibleNudges.map((nudge) => (
        <section
          key={nudge.id}
          className={
            nudge.tone === "warning"
              ? responsiveStyles.dashboardNudgeCard
              : "dashboard-reveal rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/35 sm:p-5"
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
            <div className="min-w-0">
              <p
                className={`m-0 text-xs font-semibold uppercase tracking-[0.14em] ${
                  nudge.tone === "warning"
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-blue-800 dark:text-blue-300"
                }`}
              >
                {nudge.tone === "warning" ? "Setup Priority" : "Coverage Reminder"}
              </p>
              <p
                className={`m-0 mt-1 text-sm font-semibold ${
                  nudge.tone === "warning"
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-blue-900 dark:text-blue-200"
                }`}
              >
                {nudge.message}
              </p>
              <p
                className={`m-0 mt-1 text-sm ${
                  nudge.tone === "warning"
                    ? "text-amber-800/90 dark:text-amber-300/90"
                    : "text-blue-800/90 dark:text-blue-300/90"
                }`}
              >
                {nudge.rationale}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={
                  nudge.tone === "warning"
                    ? responsiveStyles.warningBannerButton
                    : "rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/40"
                }
                onClick={() => {
                  if (nudge.action === "setup") {
                    navigate("/welcome-setup");
                    return;
                  }

                  if (nudge.action === "templates") {
                    navigate("/clients?templateFilter=without");
                    return;
                  }

                  onOpenAccountSettings?.();
                }}
              >
                {nudge.action === "setup"
                  ? "Complete setup"
                  : nudge.action === "templates"
                    ? "Set up templates"
                    : "Open Settings"}
              </button>
              <button
                type="button"
                className={
                  nudge.tone === "warning"
                    ? "rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    : "rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/40"
                }
                onClick={() =>
                  setDismissedNudgeIds((current) =>
                    current.indexOf(nudge.id) >= 0 ? current : [...current, nudge.id],
                  )
                }
              >
                Dismiss
              </button>
            </div>
          </div>
        </section>
      ))}

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

      <CarFlyAnimation>
        {(triggerCar) => (
          <section className={responsiveStyles.dashboardKpiGrid}>
            {kpis.map((kpi, index) => {
              const to = isAuthenticated ? kpi.href : "/login";
              const isCar = kpi.label === "Drive hours" || kpi.label === "Total distance";
              const isRoutesTodayCard = kpi.label === "Routes today";

              if (isRoutesTodayCard && isAuthenticated) {
                return (
                  <button
                    key={kpi.label}
                    type="button"
                    className={`${responsiveStyles.dashboardKpiCard} group w-full text-left`}
                    style={{ animationDelay: `${80 + index * 45}ms` }}
                    onClick={() => {
                      void handleRoutesTodayClick();
                    }}
                    disabled={isRouteRunsLoading}
                  >
                    <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
                    <p className={responsiveStyles.dashboardKpiValue}>{kpi.value}</p>
                    <p className={`${responsiveStyles.dashboardKpiDelta} ${kpi.tone}`}>
                      {isRouteRunsLoading ? "Loading saved runs..." : kpi.delta}
                    </p>
                    {typeof kpi.progressPercent === "number" && (
                      <div className={responsiveStyles.dashboardKpiProgressTrack}>
                        <div
                          className={responsiveStyles.dashboardKpiProgressFill}
                          style={{
                            width: `${Math.max(0, Math.min(100, kpi.progressPercent))}%`,
                            animationDelay: `${140 + index * 45}ms`,
                          }}
                        />
                      </div>
                    )}
                    <p className="m-0 mt-2 text-xs font-medium text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                      {kpi.trend}
                    </p>
                  </button>
                );
              }

              return (
                <Link
                  key={kpi.label}
                  to={to}
                  className={`${responsiveStyles.dashboardKpiCard} group`}
                  style={{ animationDelay: `${80 + index * 45}ms` }}
                  onClick={isCar ? triggerCar : undefined}
                >
                  <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
                  <p className={responsiveStyles.dashboardKpiValue}>{kpi.value}</p>
                  <p className={`${responsiveStyles.dashboardKpiDelta} ${kpi.tone}`}>{kpi.delta}</p>
                  {typeof kpi.progressPercent === "number" && (
                    <div className={responsiveStyles.dashboardKpiProgressTrack}>
                      <div
                        className={responsiveStyles.dashboardKpiProgressFill}
                        style={{
                          width: `${Math.max(0, Math.min(100, kpi.progressPercent))}%`,
                          animationDelay: `${140 + index * 45}ms`,
                        }}
                      />
                    </div>
                  )}
                  <p className="m-0 mt-2 text-xs font-medium text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                    {kpi.trend}
                  </p>
                </Link>
              );
            })}
          </section>
        )}
      </CarFlyAnimation>

      {lastUpdatedLabel && (
        <p className="m-0 -mt-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
          Last updated: {lastUpdatedLabel}
        </p>
      )}

      {hasRouteDraft && (
        <section className={responsiveStyles.dashboardCard}>
          <h2 className={responsiveStyles.cardTitle}>Route Draft</h2>
          <p className={responsiveStyles.cardDescription}>
            Planning for {resolveDraftDateLabel(routePlannerDraft?.planningDate)} ·{" "}
            {draftSelectedCount} client{draftSelectedCount === 1 ? "" : "s"}
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
        </section>
      )}

      <section className="dashboard-reveal grid gap-4 xl:grid-cols-2">
        <article className={responsiveStyles.dashboardCard}>
          <h2 className={responsiveStyles.cardTitle}>Busiest Days</h2>
          <p className={responsiveStyles.cardDescription}>
            Average scheduled visits by day of week across all routes.
          </p>
          {busiestDays.length === 0 ? (
            <p
              className={`${responsiveStyles.cardDescription} mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700`}
            >
              No route history yet. Run an optimization to populate this view.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-2 p-0">
              {busiestDays.map((day) => (
                <li key={day.dayLabel} className={responsiveStyles.dashboardTrendRow}>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {day.dayLabel}
                  </span>
                  <div className={responsiveStyles.dashboardTrendTrack}>
                    <div
                      className={responsiveStyles.dashboardTrendFill}
                      style={{ width: `${(day.avgVisits / maxBusiestAvg) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {day.avgVisits.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={responsiveStyles.dashboardCard}>
          <h2 className={responsiveStyles.cardTitle}>Client Risk Panel</h2>
          <p className={responsiveStyles.cardDescription}>
            Clients frequently unscheduled or late in the last 30 days.
          </p>
          {patientRisks.length === 0 ? (
            <p
              className={`${responsiveStyles.cardDescription} mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700`}
            >
              No at-risk clients detected.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-2 p-0">
              {patientRisks.map((risk) => (
                <li key={risk.patientId} className={responsiveStyles.dashboardRiskItem}>
                  <div>
                    <p className={responsiveStyles.cardTitle}>
                      {risk.firstName} {risk.lastName}
                    </p>
                    <p className={`${responsiveStyles.cardDescription} mt-0.5`}>
                      {risk.totalAppearances} total visit{risk.totalAppearances === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {risk.unscheduledCount > 0 && (
                      <span className={responsiveStyles.dashboardRiskBadgeAmber}>
                        {risk.unscheduledCount} unscheduled
                      </span>
                    )}
                    {risk.lateCount > 0 && (
                      <span className={responsiveStyles.dashboardRiskBadgeRose}>
                        {risk.lateCount} late
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="dashboard-reveal grid gap-4 xl:grid-cols-2">
        <article className={responsiveStyles.dashboardCard}>
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
                  <div className="min-w-0">
                    <p className={responsiveStyles.cardTitle}>
                      {stop.time} · {stop.patientName || "Client"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className={`${responsiveStyles.cardDescription} m-0`}>
                        {stop.destination}
                      </p>
                      {stop.templateName && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {stop.templateName}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={responsiveStyles.dashboardStatusPill}>
                    {toStopStatusLabel(stop.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={responsiveStyles.dashboardCard}>
          <h2 className={responsiveStyles.cardTitle}>Weekly On-time Trend</h2>
          <p className={responsiveStyles.cardDescription}>
            Weighted on-time percentage over the last 7 planning days.
          </p>
          <ul className="m-0 mt-4 list-none space-y-2 p-0">
            {trendBars.map((day, index) => (
              <li key={`${day.label}-${day.date}`} className={responsiveStyles.dashboardTrendRow}>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {day.label}
                </span>
                <div className={responsiveStyles.dashboardTrendTrack}>
                  <div
                    className={responsiveStyles.dashboardTrendFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, day.onTimeRatePercent))}%`,
                      animationDelay: `${70 + index * 30}ms`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {Math.round(day.onTimeRatePercent)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <RouteRunPickerModal
        isOpen={isRunPickerOpen}
        planningDateLabel={todayPlanningDateLabel}
        runs={routeRuns}
        selectedRunId={selectedRouteRunId}
        onClose={() => {
          if (isOpeningRouteRun) return;
          setIsRunPickerOpen(false);
          setRouteRunsError("");
        }}
        onSelectRun={setSelectedRouteRunId}
        onConfirmSelection={() => {
          if (!selectedRouteRunId) return;
          setIsRunPickerOpen(false);
          setRouteRunsError("");
          openRouteRun(selectedRouteRunId, todayPlanningDate);
        }}
        isLoading={isRouteRunsLoading}
        isConfirming={isOpeningRouteRun}
        errorMessage={routeRunsError}
        onRetry={() => {
          void handleRoutesTodayClick();
        }}
      />
    </main>
  );
}
