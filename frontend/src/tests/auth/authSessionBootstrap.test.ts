import { afterEach, describe, expect, it } from "vitest";
import {
  beginAuthBootstrap,
  clearAuthSession,
  completeAuthBootstrap,
  getAuthBootstrapEventName,
  recordAuthBootstrapFailure,
  recordAuthBootstrapTimeout,
  waitForAuthBootstrap,
} from "../../components/auth/authSession";

describe("authSession bootstrap telemetry", () => {
  afterEach(() => {
    completeAuthBootstrap();
    clearAuthSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("emits started and completed events and resolves waiters", async () => {
    const events: Array<{ phase: string; durationMs?: number | null }> = [];
    const eventName = getAuthBootstrapEventName();
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ phase: string; durationMs?: number | null }>;
      events.push(customEvent.detail);
    };

    window.addEventListener(eventName, listener);

    beginAuthBootstrap();
    const waitPromise = waitForAuthBootstrap();
    completeAuthBootstrap();
    await waitPromise;

    window.removeEventListener(eventName, listener);

    expect(events[0]?.phase).toBe("started");
    expect(events[1]?.phase).toBe("completed");
    expect(typeof events[1]?.durationMs === "number" || events[1]?.durationMs === null).toBe(true);
  });

  it("emits failed and timed_out telemetry events", () => {
    const phases: string[] = [];
    const eventName = getAuthBootstrapEventName();
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ phase: string }>;
      phases.push(customEvent.detail.phase);
    };

    window.addEventListener(eventName, listener);

    beginAuthBootstrap();
    recordAuthBootstrapFailure(new Error("boom"));
    recordAuthBootstrapTimeout(8000);
    completeAuthBootstrap();

    window.removeEventListener(eventName, listener);

    expect(phases).toContain("started");
    expect(phases).toContain("failed");
    expect(phases).toContain("timed_out");
    expect(phases).toContain("completed");
  });
});
