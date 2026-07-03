import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardSummaryResponse, WeeklyWorkingHours } from "../../../../shared/contracts";
import { fetchDashboardSummary } from "../home/homeDashboardService";
import { hasConfiguredSchedule } from "../home/workingHoursStatus";

export type NotificationSeverity = "action" | "info";

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  severity: NotificationSeverity;
  count?: number;
  to?: string; // in-app route link
  onSelect?: () => void; // e.g. open the Settings modal
};

export type NotificationsAuthUser = {
  workingHours?: WeeklyWorkingHours | null;
} | null;

const SUMMARY_TTL_MS = 60_000;
const SEEN_KEY = "routefy.notifications.seenSignature";

// Module-level cache so navigating between pages doesn't refetch the dashboard
// summary on every AppHeader mount. Best-effort and shared across the app.
let summaryCache: { data: DashboardSummaryResponse; fetchedAt: number } | null = null;
let summaryInFlight: Promise<DashboardSummaryResponse> | null = null;

const loadSummary = async (): Promise<DashboardSummaryResponse> => {
  if (summaryCache && Date.now() - summaryCache.fetchedAt < SUMMARY_TTL_MS) {
    return summaryCache.data;
  }
  if (!summaryInFlight) {
    summaryInFlight = fetchDashboardSummary()
      .then((data) => {
        summaryCache = { data, fetchedAt: Date.now() };
        return data;
      })
      .finally(() => {
        summaryInFlight = null;
      });
  }
  return summaryInFlight;
};

// Test-only: clear the shared summary cache between cases.
export const __resetNotificationsCache = () => {
  summaryCache = null;
  summaryInFlight = null;
};

const readSeenSignature = (): string => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};

const writeSeenSignature = (signature: string) => {
  try {
    localStorage.setItem(SEEN_KEY, signature);
  } catch {
    // localStorage unavailable (private mode / quota) — the dot just won't persist.
  }
};

// Pure: assemble the notification list from the aggregate signals we already
// have (dashboard summary + the auth user's working hours). Kept exported so it
// can be unit-tested without the hook wiring.
export const buildNotificationItems = (
  summary: DashboardSummaryResponse | null,
  authUser: NotificationsAuthUser,
  onOpenAccountSettings: () => void,
): NotificationItem[] => {
  const items: NotificationItem[] = [];

  // Setup — working hours not configured. Free from the auth user, no fetch.
  if (!hasConfiguredSchedule(authUser?.workingHours)) {
    items.push({
      id: "setup-working-hours",
      title: "Finish setting up",
      detail: "Set your working hours so routes respect your shift.",
      severity: "action",
      onSelect: onOpenAccountSettings,
    });
  }

  // Latest route health — today's unscheduled / late (from the persisted run).
  const unscheduled = summary?.snapshot.unscheduledVisits ?? 0;
  const delayed = summary?.snapshot.delayedRoutes ?? 0;
  if (unscheduled > 0 || delayed > 0) {
    const parts: string[] = [];
    if (unscheduled > 0) {
      parts.push(`${unscheduled} unscheduled visit${unscheduled === 1 ? "" : "s"}`);
    }
    if (delayed > 0) {
      parts.push(`${delayed} route${delayed === 1 ? "" : "s"} running late`);
    }
    items.push({
      id: "route-health",
      title: "Your latest route needs attention",
      detail: parts.join(" · "),
      severity: "action",
      count: unscheduled + delayed,
      to: "/route-planner",
    });
  }

  // Idle clients — active but unscheduled 30+ days (same rule as the Idle tab).
  const idle = summary?.kpis.staleClientsCount ?? 0;
  if (idle > 0) {
    items.push({
      id: "idle",
      title: `${idle} idle client${idle === 1 ? "" : "s"}`,
      detail: "Not scheduled in 30+ days — review or archive.",
      severity: "info",
      count: idle,
      to: "/clients?state=idle",
    });
  }

  // Standing announcement — the iOS app is on the way. Lowest priority, so it
  // sits under any actionable items. Non-interactive (no link).
  items.push({
    id: "ios-coming-soon",
    title: "Routefy for iOS - coming soon!",
    detail: "A native iPhone app is on the way, so you can plan routes on the go.",
    severity: "info",
  });

  return items;
};

// Stable signature of the current items (id + count) — the unread dot re-appears
// whenever this changes, and is cleared once the user opens the panel.
const signatureOf = (items: NotificationItem[]): string =>
  items.map((item) => `${item.id}:${item.count ?? 1}`).join("|");

export const useNotifications = (
  authUser: NotificationsAuthUser,
  onOpenAccountSettings: () => void,
) => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(
    summaryCache?.data ?? null,
  );
  const [seenSignature, setSeenSignature] = useState<string>(() => readSeenSignature());

  useEffect(() => {
    let active = true;
    loadSummary()
      .then((data) => {
        if (active) {
          setSummary(data);
        }
      })
      .catch(() => {
        // Best-effort: a failed summary just means fewer notifications, not an error.
      });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(
    () => buildNotificationItems(summary, authUser, onOpenAccountSettings),
    [summary, authUser, onOpenAccountSettings],
  );

  const signature = signatureOf(items);
  const hasUnread = items.length > 0 && signature !== seenSignature;

  const markAllRead = useCallback(() => {
    writeSeenSignature(signature);
    setSeenSignature(signature);
  }, [signature]);

  return { items, hasUnread, markAllRead };
};
