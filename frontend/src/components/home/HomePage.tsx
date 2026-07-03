import { useEffect, useMemo, useState, type ReactNode } from "react";
import CarFlyAnimation from "../shared/CarFlyAnimation";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type {
  AuthUser,
  DashboardBusiestDay,
  DashboardPatientRisk,
  DashboardSummaryResponse,
  DashboardTrendPoint,
  DashboardUpcomingStop,
} from "../../../../shared/contracts";
import { fetchDashboardSummary, fetchRouteRunsForPlanningDate } from "./homeDashboardService";
import { resolveTodayHoursDisplay } from "./todayHours";
import { hasConfiguredSchedule } from "./workingHoursStatus";
import { buildGetStartedSteps, countGetStartedDone, isGetStartedComplete } from "./getStartedSteps";
import { OnboardingTour } from "./OnboardingTour";
import { InfoDialog } from "../shared/InfoDialog";
import {
  clearRoutePlannerDraft,
  readRoutePlannerDraft,
} from "../../features/route-planner/state/routePlannerDraft";
import { responsiveStyles } from "../responsiveStyles";
import RouteRunPickerModal, { type RouteRunPickerItem } from "../modals/RouteRunPickerModal";

type HomePageProps = {
  isAuthenticated: boolean;
  authUser?: AuthUser | null;
  onOpenAccountSettings?: (section?: "profile" | "working-hours" | "route") => void;
};

// Temporarily hidden per product request — kept so it can be flipped back on.
const SHOW_TEMPLATE_COVERAGE_NUDGE = false;

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
  if (!firstToken) {
    return "there";
  }
  // Capitalize the first character so a lowercase name (e.g. "test") still reads
  // as a proper greeting ("Test"); leave the rest of the token untouched.
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
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
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [isRunPickerOpen, setIsRunPickerOpen] = useState(false);
  const [routeRuns, setRouteRuns] = useState<RouteRunPickerItem[]>([]);
  const [selectedRouteRunId, setSelectedRouteRunId] = useState<string | null>(null);
  const [routeRunsError, setRouteRunsError] = useState("");
  const [isRouteRunsLoading, setIsRouteRunsLoading] = useState(false);
  const [isOpeningRouteRun, setIsOpeningRouteRun] = useState(false);
  const [isCoverageInfoOpen, setIsCoverageInfoOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboardSummary(null);
      setDashboardError("");
      return;
    }

    let active = true;

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
      // Placeholder cards while the summary loads — must mirror the loaded set's
      // labels AND order below, so the grid doesn't reshuffle when data arrives.
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
          label: "Active clients",
          value: "—",
          delta: "All time",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/clients",
        },
        {
          label: "Idle clients",
          value: "—",
          delta: "Not used in 30+ days",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/clients?state=idle",
        },
        {
          label: "Template coverage",
          value: "—",
          delta: "No active clients yet",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/clients?templateFilter=without",
          progressPercent: 0,
        },
        {
          label: "Visits this week",
          value: "—",
          delta: "Last 7 days",
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
          delta: "Last 7 days",
          tone: "text-slate-500",
          trend: "No baseline yet",
          href: "/route-planner",
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
        label: "Idle clients",
        value: String(dashboardSummary.kpis.staleClientsCount),
        delta: "Not used in 30+ days",
        tone: dashboardSummary.kpis.staleClientsCount > 0 ? "text-amber-600" : "text-slate-500",
        trend: dashboardSummary.kpis.staleClientsCount > 0 ? "Tap to review & archive →" : "",
        // Nothing to act on at zero — the card becomes non-clickable (no redirect).
        href: dashboardSummary.kpis.staleClientsCount > 0 ? "/clients?state=idle" : undefined,
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

  // The summary request is in flight when we're signed in but have neither a
  // snapshot nor an error yet. Drives the shimmer on the KPI value/delta lines.
  const isDashboardPending = isAuthenticated && !dashboardSummary && !dashboardError;

  const renderKpiValue = (value: string) =>
    isDashboardPending ? (
      <span className={responsiveStyles.dashboardKpiValueSkeleton} aria-hidden="true" />
    ) : (
      <p className={responsiveStyles.dashboardKpiValue}>{value}</p>
    );

  const renderKpiDelta = (delta: ReactNode, tone: string) =>
    isDashboardPending ? (
      <span className={responsiveStyles.dashboardKpiDeltaSkeleton} aria-hidden="true" />
    ) : (
      <p className={`${responsiveStyles.dashboardKpiDelta} ${tone}`}>{delta}</p>
    );

  const renderPanelSkeleton = (rows: number, tall = false) => (
    <ul className="m-0 mt-4 list-none space-y-2.5 p-0" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <li
          key={rowIndex}
          className={
            tall
              ? responsiveStyles.dashboardPanelSkeletonRowTall
              : responsiveStyles.dashboardPanelSkeletonRow
          }
        />
      ))}
    </ul>
  );

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
    // Temporarily hidden — flip to re-enable the "N clients missing templates" nudge.
    if (SHOW_TEMPLATE_COVERAGE_NUDGE && activePatientCount > 0) {
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

  // First-run "Get started" checklist — shown until a new user finishes all
  // three steps (then latched off in localStorage so it never returns).
  const getStartedSteps = useMemo(
    () =>
      buildGetStartedSteps({
        workingHoursDone: hasConfiguredSchedule(authUser?.workingHours),
        hasClients: (dashboardSummary?.kpis.activePatientCount ?? 0) > 0,
        hasRunRoute:
          (dashboardSummary?.snapshot.completedRoutes ?? 0) > 0 ||
          (dashboardSummary?.kpis.routesToday ?? 0) > 0 ||
          (dashboardSummary?.kpis.visitsScheduledLast7Days ?? 0) > 0,
      }),
    [authUser?.workingHours, dashboardSummary],
  );
  const getStartedComplete = isGetStartedComplete(getStartedSteps);
  // Latch the "finished onboarding" flag per nurse id, not globally, so a new
  // user on a shared browser gets a fresh checklist rather than inheriting the
  // previous user's dismissed/completed state.
  const getStartedLatchKey = authUser?.id ? `routefy.getStarted.done:${authUser.id}` : null;
  const readGetStartedLatch = (key: string | null) => {
    if (!key) return false;
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const [getStartedDismissed, setGetStartedDismissed] = useState<boolean>(() =>
    readGetStartedLatch(getStartedLatchKey),
  );
  // Re-sync the latch when the signed-in nurse changes (e.g. account switch
  // without a full remount) so it always reflects the current user.
  useEffect(() => {
    setGetStartedDismissed(readGetStartedLatch(getStartedLatchKey));
  }, [getStartedLatchKey]);
  useEffect(() => {
    if (getStartedComplete && !getStartedDismissed && getStartedLatchKey) {
      try {
        localStorage.setItem(getStartedLatchKey, "1");
      } catch {
        // localStorage unavailable — the checklist just won't persist its latch.
      }
      setGetStartedDismissed(true);
    }
  }, [getStartedComplete, getStartedDismissed, getStartedLatchKey]);
  const dismissGetStarted = () => {
    if (getStartedLatchKey) {
      try {
        localStorage.setItem(getStartedLatchKey, "1");
      } catch {
        // ignore
      }
    }
    setGetStartedDismissed(true);
  };
  // Wait for the dashboard summary before deciding "new user" — otherwise
  // getStartedComplete is briefly false (client/route counts unknown) and the
  // onboarding surfaces flash in for existing users on first load.
  const isOnboardingStatusResolved = dashboardSummary !== null;
  const showGetStarted =
    isAuthenticated && isOnboardingStatusResolved && !getStartedDismissed && !getStartedComplete;

  // Onboarding tour card — same "new user" gate as the checklist, with its own
  // per-nurse dismiss latch so watching/closing the tour is independent of the
  // checklist. Hidden once onboarding is complete.
  const tourLatchKey = authUser?.id ? `routefy.tour.done:${authUser.id}` : null;
  const [tourDismissed, setTourDismissed] = useState<boolean>(() =>
    readGetStartedLatch(tourLatchKey),
  );
  useEffect(() => {
    setTourDismissed(readGetStartedLatch(tourLatchKey));
  }, [tourLatchKey]);
  const dismissTour = () => {
    if (tourLatchKey) {
      try {
        localStorage.setItem(tourLatchKey, "1");
      } catch {
        // ignore
      }
    }
    setTourDismissed(true);
  };
  const showTour =
    isAuthenticated && isOnboardingStatusResolved && !tourDismissed && !getStartedComplete;

  const greetingName = resolveGreetingName(authUser?.displayName);
  const greetingPrefix = resolveGreetingPrefix();
  const todayHoursDisplay = resolveTodayHoursDisplay(authUser?.workingHours);
  const lastUpdatedLabel = resolveLastUpdatedLabel(dashboardSummary);
  // Real coverage numbers for the info modal — so the example matches the card,
  // not a hard-coded "1 / 4".
  const coverageCovered = dashboardSummary?.kpis.templatedActivePatientCount ?? 0;
  const coverageTotal = dashboardSummary?.kpis.activePatientCount ?? 0;
  const coverageWithout = Math.max(0, coverageTotal - coverageCovered);
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
      {showGetStarted && (
        <section className={responsiveStyles.getStartedCard}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={responsiveStyles.getStartedEyebrow}>Get started</p>
              <p className={responsiveStyles.getStartedTitle}>
                {countGetStartedDone(getStartedSteps)} of {getStartedSteps.length} done
              </p>
            </div>
            <button
              type="button"
              onClick={dismissGetStarted}
              aria-label="Dismiss get started checklist"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <ul className={responsiveStyles.getStartedList}>
            {getStartedSteps.map((step) => (
              <li key={step.id} className={responsiveStyles.getStartedRow}>
                <span
                  className={
                    step.done
                      ? responsiveStyles.getStartedCheckDone
                      : responsiveStyles.getStartedCheckTodo
                  }
                  aria-hidden="true"
                >
                  {step.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <polyline
                        points="20 6 9 17 4 12"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold ${step.done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}
                  >
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {step.detail}
                    </span>
                  )}
                </span>
                {!step.done &&
                  (step.to ? (
                    <Link to={step.to} className={responsiveStyles.getStartedStepButton}>
                      {step.cta}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenAccountSettings?.("working-hours")}
                      className={responsiveStyles.getStartedStepButton}
                    >
                      {step.cta}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showTour && <OnboardingTour onDismiss={dismissTour} />}

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

      {/* The Get-started checklist supersedes the profile setup nudges while it's
          visible — showing both is redundant. Nudges return once onboarding is
          done/dismissed to surface any remaining gaps (route priority, home address).
          Also wait for the onboarding status to resolve so the amber nudges don't
          flash in before the checklist decides whether to supersede them. */}
      {isOnboardingStatusResolved &&
        !showGetStarted &&
        visibleNudges.map((nudge) => (
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

      {isAuthenticated && dashboardError && (
        <section className="dashboard-reveal rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900/70 dark:bg-rose-950/30 sm:p-5">
          <h2 className={responsiveStyles.cardTitle}>Dashboard data unavailable</h2>
          <p className={`${responsiveStyles.cardDescription} mt-2`}>
            {dashboardSummary
              ? "Your last successful dashboard snapshot is still displayed."
              : "No dashboard snapshot is available yet."}
          </p>
          <div className={responsiveStyles.dashboardDraftActions}>
            <button
              type="button"
              className={responsiveStyles.secondaryButton}
              onClick={() => setDashboardRefreshKey((value) => value + 1)}
            >
              Retry Dashboard
            </button>
          </div>
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
                    {renderKpiValue(kpi.value)}
                    {renderKpiDelta(
                      isRouteRunsLoading ? "Loading saved runs..." : kpi.delta,
                      kpi.tone,
                    )}
                    {!isDashboardPending && typeof kpi.progressPercent === "number" && (
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
                    {!isDashboardPending && (
                      <p className="m-0 mt-2 text-xs font-medium text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                        {kpi.trend}
                      </p>
                    )}
                  </button>
                );
              }

              const cardBody = (
                <>
                  <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
                  {renderKpiValue(kpi.value)}
                  {renderKpiDelta(kpi.delta, kpi.tone)}
                  {!isDashboardPending && typeof kpi.progressPercent === "number" && (
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
                  {!isDashboardPending && kpi.trend && (
                    <p className="m-0 mt-2 text-xs font-medium text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                      {kpi.trend}
                    </p>
                  )}
                </>
              );

              // No destination (e.g. zero inactive clients) → a static, non-clickable card.
              if (!to) {
                return (
                  <div
                    key={kpi.label}
                    className={responsiveStyles.dashboardKpiCard}
                    style={{ animationDelay: `${80 + index * 45}ms` }}
                  >
                    {cardBody}
                  </div>
                );
              }

              // "Template coverage" is jargon — pair its title with an "i" that
              // explains it. The title row (with the button) sits outside the Link,
              // since nesting a button inside an anchor is invalid; the rest of the
              // card stays the navigation target.
              if (kpi.label === "Template coverage") {
                return (
                  <div
                    key={kpi.label}
                    className={`${responsiveStyles.dashboardKpiCard} group`}
                    style={{ animationDelay: `${80 + index * 45}ms` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
                      <button
                        type="button"
                        aria-label="What is template coverage?"
                        onClick={() => setIsCoverageInfoOpen(true)}
                        className={responsiveStyles.infoIconButton}
                      >
                        i
                      </button>
                    </div>
                    <Link to={to} className="block">
                      {renderKpiValue(kpi.value)}
                      {renderKpiDelta(kpi.delta, kpi.tone)}
                      {!isDashboardPending && typeof kpi.progressPercent === "number" && (
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
                      {!isDashboardPending && kpi.trend && (
                        <p className="m-0 mt-2 text-xs font-medium text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                          {kpi.trend}
                        </p>
                      )}
                    </Link>
                  </div>
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
                  {cardBody}
                </Link>
              );
            })}
          </section>
        )}
      </CarFlyAnimation>

      <InfoDialog
        open={isCoverageInfoOpen}
        title="Template coverage"
        onClose={() => setIsCoverageInfoOpen(false)}
      >
        <p className={responsiveStyles.confirmDialogMessage}>
          The share of your active clients that have a recurring template — an automatic weekly
          visit schedule.
        </p>
        <ul className="m-0 mb-5 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          {coverageTotal > 0 ? (
            <>
              <li>
                Right now{" "}
                <b>
                  {coverageCovered} / {coverageTotal} clients
                </b>{" "}
                {coverageCovered === 1 ? "has" : "have"} a recurring template that repeats
                automatically each week.
              </li>
              {coverageWithout > 0 && (
                <li>
                  The other {coverageWithout} would be added to each route by hand until you give{" "}
                  {coverageWithout === 1 ? "it" : "them"} a template.
                </li>
              )}
            </>
          ) : (
            <li>Add active clients, then give them recurring templates to lift coverage.</li>
          )}
          <li>
            Higher coverage means less manual scheduling — open a client and “Add recurring
            template” to raise it.
          </li>
        </ul>
        <p className="m-0 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          How recurring templates work
        </p>
        <ul className="m-0 mb-5 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Pick the weekdays to repeat — e.g. Mon, Wed, Fri.</li>
          <li>Set a start date; leave the end date blank to repeat indefinitely.</li>
          <li>On matching days the client is auto-added to your Route Planner.</li>
          <li>Visits reuse the client&apos;s saved visit window and duration.</li>
        </ul>
      </InfoDialog>

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
          {isDashboardPending ? (
            renderPanelSkeleton(5)
          ) : busiestDays.length === 0 ? (
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
          {isDashboardPending ? (
            renderPanelSkeleton(3, true)
          ) : patientRisks.length === 0 ? (
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
          {isDashboardPending ? (
            renderPanelSkeleton(3, true)
          ) : upcomingStops.length === 0 ? (
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
          {isDashboardPending ? (
            renderPanelSkeleton(5)
          ) : (
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
          )}
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
