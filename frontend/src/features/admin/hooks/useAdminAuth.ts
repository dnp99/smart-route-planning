import { useCallback, useEffect, useState } from "react";
import { adminLogin, adminLogout, fetchAdminMe, type AdminUser } from "../api/adminService";

type AdminAuthState = {
  admin: AdminUser | null;
  isResolving: boolean;
  isSigningIn: boolean;
  error: string;
};

// Owns the admin session lifecycle: resolves the current admin on mount (via the
// admin cookie), signs in, and signs out. Isolated from the nurse auth session.
export const useAdminAuth = () => {
  const [state, setState] = useState<AdminAuthState>({
    admin: null,
    isResolving: true,
    isSigningIn: false,
    error: "",
  });

  useEffect(() => {
    let active = true;
    void fetchAdminMe()
      .then((admin) => {
        if (active) {
          setState((prev) => ({ ...prev, admin, isResolving: false }));
        }
      })
      .catch(() => {
        if (active) {
          setState((prev) => ({ ...prev, admin: null, isResolving: false }));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isSigningIn: true, error: "" }));
    try {
      const admin = await adminLogin(email, password);
      setState((prev) => ({ ...prev, admin, isSigningIn: false, error: "" }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSigningIn: false,
        error: error instanceof Error ? error.message : "Unable to sign in.",
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await adminLogout();
    setState((prev) => ({ ...prev, admin: null, error: "" }));
  }, []);

  return {
    admin: state.admin,
    isResolving: state.isResolving,
    isSigningIn: state.isSigningIn,
    error: state.error,
    signIn,
    signOut,
  };
};
