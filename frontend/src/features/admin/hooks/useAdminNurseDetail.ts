import { useCallback, useEffect, useState } from "react";
import { fetchAdminNurseDetail, type AdminNurseDetail } from "../api/adminService";

type AdminNurseDetailState = {
  detail: AdminNurseDetail | null;
  isLoading: boolean;
  error: string;
};

// Loads one nurse's full detail (profile + patients + activity feed). The server
// records an admin.nurse.view audit event for this PHI-exposing read. `reload`
// re-fetches after an admin action mutates the nurse.
export const useAdminNurseDetail = (nurseId: string | undefined) => {
  const [state, setState] = useState<AdminNurseDetailState>({
    detail: null,
    isLoading: true,
    error: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!nurseId) {
      return;
    }
    let active = true;
    setState({ detail: null, isLoading: true, error: "" });

    void fetchAdminNurseDetail(nurseId)
      .then((detail) => {
        if (active) {
          setState({ detail, isLoading: false, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            detail: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unable to load this nurse.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [nurseId, reloadKey]);

  return { ...state, reload };
};
