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
