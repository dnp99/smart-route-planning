import { useEffect, useRef, useState } from "react";
import { resolveApiBaseUrl } from "./apiBaseUrl";

type AnalyticsCounters = {
  requests: number;
  successes: number;
  failures: number;
  cacheHits: number;
  rateLimits: number;
};

type AnalyticsEvent = {
  route: string;
  outcome: string;
  timestamp: string;
  details?: Record<string, string | number | boolean>;
};

type AnalyticsSnapshot = {
  startedAt: string;
  optimizeRoute: AnalyticsCounters;
  addressAutocomplete: AnalyticsCounters;
  recentEvents: AnalyticsEvent[];
};

type AnalyticsErrorResponse = {
  error?: string;
};

const isAnalyticsSnapshot = (value: unknown): value is AnalyticsSnapshot => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<AnalyticsSnapshot>;
  return (
    typeof payload.startedAt === "string" &&
    typeof payload.optimizeRoute?.requests === "number" &&
    typeof payload.addressAutocomplete?.requests === "number" &&
    Array.isArray(payload.recentEvents)
  );
};

type AdminDebugPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

function AdminDebugPanel({ isOpen, onClose }: AdminDebugPanelProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const activeRequestControllerRef = useRef<AbortController | null>(null);

  const fetchAnalytics = (showLoading = true) => {
    activeRequestControllerRef.current?.abort();

    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    const apiBaseUrl = resolveApiBaseUrl();

    if (showLoading) {
      setIsLoading(true);
    }

    setError("");

    fetch(`${apiBaseUrl}/api/analytics`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) =>
        response.json().then((payload) => ({
          response,
          payload,
        })),
      )
      .then(({ response, payload }) => {
        if (!response.ok) {
          const message =
            typeof (payload as AnalyticsErrorResponse)?.error === "string"
              ? (payload as AnalyticsErrorResponse).error
              : "Unable to load analytics.";
          throw new Error(message);
        }

        if (!isAnalyticsSnapshot(payload)) {
          throw new Error("Unexpected analytics response.");
        }

        setAnalytics(payload);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load analytics.",
        );
      })
      .finally(() => {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null;
        }

        if (showLoading) {
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    if (!isOpen) {
      activeRequestControllerRef.current?.abort();
      activeRequestControllerRef.current = null;
      return;
    }

    fetchAnalytics(true);

    return () => {
      activeRequestControllerRef.current?.abort();
      activeRequestControllerRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col rounded-2xl border border-slate-200/10 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Debug
            </p>
            <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
              Lightweight Google API analytics snapshot since last deployment
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
          {isLoading && <p className="m-0">Loading analytics…</p>}

          {!isLoading && error && (
            <div className="grid gap-2">
              <p className="m-0 text-amber-700 dark:text-amber-300">{error}</p>
              <button
                type="button"
                onClick={() => fetchAnalytics(true)}
                className="w-fit rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && analytics && (
            <div className="grid gap-3">
              <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
                Started: {new Date(analytics.startedAt).toLocaleString()}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => fetchAnalytics(true)}
                  className="w-fit rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200/70 bg-slate-100/70 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="m-0 font-semibold text-slate-700 dark:text-slate-200">
                    Optimize Route
                  </p>
                  <p className="m-0">Req: {analytics.optimizeRoute.requests}</p>
                  <p className="m-0">OK: {analytics.optimizeRoute.successes}</p>
                  <p className="m-0">Fail: {analytics.optimizeRoute.failures}</p>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-slate-100/70 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="m-0 font-semibold text-slate-700 dark:text-slate-200">
                    Autocomplete
                  </p>
                  <p className="m-0">Req: {analytics.addressAutocomplete.requests}</p>
                  <p className="m-0">OK: {analytics.addressAutocomplete.successes}</p>
                  <p className="m-0">Fail: {analytics.addressAutocomplete.failures}</p>
                  <p className="m-0">Cache: {analytics.addressAutocomplete.cacheHits}</p>
                  <p className="m-0">429: {analytics.addressAutocomplete.rateLimits}</p>
                </div>
              </div>

              <div className="grid gap-1">
                <p className="m-0 font-semibold text-slate-700 dark:text-slate-200">
                  Recent events
                </p>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200/70 bg-slate-100/70 p-2 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950/40">
                  {analytics.recentEvents.length === 0 ? (
                    <p className="m-0">No events yet.</p>
                  ) : (
                    analytics.recentEvents.slice(0, 8).map((event, index) => (
                      <div
                        key={`${event.timestamp}-${event.route}-${index}`}
                        className="mb-2 last:mb-0"
                      >
                        <p className="m-0">
                          {event.route} · {event.outcome}
                        </p>
                        <p className="m-0 text-slate-500 dark:text-slate-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDebugPanel;
