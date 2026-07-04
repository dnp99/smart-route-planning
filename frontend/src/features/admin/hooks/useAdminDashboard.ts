import { useEffect, useState } from "react";
import {
  fetchAdminMetrics,
  fetchAdminNurses,
  type AdminMetrics,
  type AdminNurseSummary,
} from "../api/adminService";

type AdminDashboardState = {
  nurses: AdminNurseSummary[];
  metrics: AdminMetrics | null;
  isLoading: boolean;
  error: string;
};

// Loads the users list and KPI metrics for the admin dashboard landing view.
export const useAdminDashboard = () => {
  const [state, setState] = useState<AdminDashboardState>({
    nurses: [],
    metrics: null,
    isLoading: true,
    error: "",
  });

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, isLoading: true, error: "" }));

    void Promise.all([fetchAdminNurses(), fetchAdminMetrics()])
      .then(([nurses, metrics]) => {
        if (active) {
          setState({ nurses, metrics, isLoading: false, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unable to load the dashboard.",
          }));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
};
