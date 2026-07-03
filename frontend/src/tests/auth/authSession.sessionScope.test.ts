import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../../shared/contracts";
import {
  clearAuthSession,
  registerSessionScopedCleanup,
  setAuthSession,
} from "../../components/auth/authSession";
import {
  ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY,
  resetRouteOptimizationCache,
} from "../../features/route-planner/hooks/useRouteOptimization";

// PHI-bearing browser caches must not survive a session boundary on a shared
// device — otherwise the next nurse to log in sees the previous nurse's route
// (client names + addresses). These tests lock in that guarantee, and in
// particular catch the class of bug where authSession's scoped-key string drifts
// from the key the feature actually writes.

const ROUTE_DRAFT_KEY = "careflow.route-planner.draft.v1";

const buildUser = (): AuthUser => ({
  id: "nurse-2",
  email: "second@example.com",
  displayName: "Second Nurse",
  homeAddress: null,
});

describe("session-scoped PHI cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("purges the cached optimized route from sessionStorage on logout", () => {
    window.sessionStorage.setItem(
      ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY,
      JSON.stringify({ stops: [{ patientName: "Jane Doe", address: "123 Main St" }] }),
    );

    clearAuthSession();

    expect(window.sessionStorage.getItem(ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY)).toBeNull();
  });

  it("purges the cached route on a fresh login (new user on a shared device)", () => {
    window.sessionStorage.setItem(
      ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY,
      JSON.stringify({ stops: [{ patientName: "Jane Doe" }] }),
    );
    window.localStorage.setItem(ROUTE_DRAFT_KEY, JSON.stringify({ destinations: ["p1"] }));

    setAuthSession(buildUser());

    expect(window.sessionStorage.getItem(ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(ROUTE_DRAFT_KEY)).toBeNull();
  });

  it("runs registered in-memory cache resets on both login and logout, until unregistered", () => {
    const cleanup = vi.fn();
    const unregister = registerSessionScopedCleanup(cleanup);

    setAuthSession(buildUser());
    clearAuthSession();
    expect(cleanup).toHaveBeenCalledTimes(2);

    unregister();
    clearAuthSession();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("exposes a route-cache reset that clears the sessionStorage copy", () => {
    window.sessionStorage.setItem(
      ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY,
      JSON.stringify({ stops: [] }),
    );

    resetRouteOptimizationCache();

    expect(window.sessionStorage.getItem(ROUTE_OPTIMIZATION_RESULT_STORAGE_KEY)).toBeNull();
  });
});
