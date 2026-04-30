import {
  parseDashboardSummaryResponse,
  type DashboardSummaryResponse,
} from "../../../../shared/contracts";
import { requestAuthedJson } from "../auth/authFetch";

const resolveTimezone = () => {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof detectedTimezone === "string" && detectedTimezone.trim().length > 0) {
    return detectedTimezone.trim();
  }

  return "UTC";
};

export const fetchDashboardSummary = async (): Promise<DashboardSummaryResponse> => {
  const timezone = resolveTimezone();
  const payload = await requestAuthedJson(
    `/api/dashboard/summary?timezone=${encodeURIComponent(timezone)}`,
    {
      method: "GET",
    },
    "Unable to load dashboard summary.",
  );

  const parsed = parseDashboardSummaryResponse(payload);
  if (!parsed) {
    throw new Error("Unexpected dashboard summary response format.");
  }

  return parsed;
};

export type RouteRunSummary = {
  id: string;
  planningDate: string;
  createdAt: string;
  endpointVersion: "v2" | "v3";
  optimizationObjective: "time" | "distance" | null;
  scheduledVisitCount: number;
  unscheduledVisitCount: number;
  algorithmVersion: string;
};

const toRouteRunSummary = (value: unknown): RouteRunSummary | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const endpointVersion = candidate.endpointVersion;
  const optimizationObjective = candidate.optimizationObjective;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.planningDate !== "string" ||
    typeof candidate.createdAt !== "string" ||
    (endpointVersion !== "v2" && endpointVersion !== "v3") ||
    (optimizationObjective !== "time" &&
      optimizationObjective !== "distance" &&
      optimizationObjective !== null) ||
    typeof candidate.scheduledVisitCount !== "number" ||
    typeof candidate.unscheduledVisitCount !== "number" ||
    typeof candidate.algorithmVersion !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    planningDate: candidate.planningDate,
    createdAt: candidate.createdAt,
    endpointVersion,
    optimizationObjective,
    scheduledVisitCount: candidate.scheduledVisitCount,
    unscheduledVisitCount: candidate.unscheduledVisitCount,
    algorithmVersion: candidate.algorithmVersion,
  };
};

export type RouteRunDetail = RouteRunSummary & {
  requestPayload: unknown;
  resultPayload: unknown;
};

const toRouteRunDetail = (value: unknown): RouteRunDetail | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const summary = toRouteRunSummary(candidate);
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    requestPayload: candidate.requestPayload,
    resultPayload: candidate.resultPayload,
  };
};

export const fetchRouteRunById = async (runId: string): Promise<RouteRunDetail> => {
  const payload = await requestAuthedJson(
    `/api/route-runs/${encodeURIComponent(runId)}`,
    { method: "GET" },
    "Unable to load saved route.",
  );

  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected saved route response format.");
  }

  const runRaw = (payload as Record<string, unknown>).run;
  const run = toRouteRunDetail(runRaw);
  if (!run) {
    throw new Error("Unexpected saved route response format.");
  }

  return run;
};

export const fetchRouteRunsForPlanningDate = async (
  planningDate: string,
): Promise<RouteRunSummary[]> => {
  const payload = await requestAuthedJson(
    `/api/route-runs?planningDate=${encodeURIComponent(planningDate)}`,
    { method: "GET" },
    "Unable to load saved routes.",
  );

  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected saved routes response format.");
  }

  const runsRaw = (payload as Record<string, unknown>).runs;
  if (!Array.isArray(runsRaw)) {
    throw new Error("Unexpected saved routes response format.");
  }

  const runs = runsRaw
    .map((item) => toRouteRunSummary(item))
    .filter((item): item is RouteRunSummary => item !== null);

  if (runs.length !== runsRaw.length) {
    throw new Error("Unexpected saved routes response format.");
  }

  return runs;
};
