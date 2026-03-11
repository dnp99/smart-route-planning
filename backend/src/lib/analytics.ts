type AnalyticsRoute = "optimize-route" | "address-autocomplete";
type AnalyticsOutcome =
  | "request"
  | "success"
  | "failure"
  | "cache-hit"
  | "rate-limit";

type AnalyticsEvent = {
  route: AnalyticsRoute;
  outcome: AnalyticsOutcome;
  timestamp: string;
  details?: Record<string, string | number | boolean>;
};

type RouteCounters = {
  requests: number;
  successes: number;
  failures: number;
  cacheHits: number;
  rateLimits: number;
};

type AnalyticsState = {
  optimizeRoute: RouteCounters;
  addressAutocomplete: RouteCounters;
  recentEvents: AnalyticsEvent[];
  startedAt: string;
};

const MAX_RECENT_EVENTS = 50;

const createRouteCounters = (): RouteCounters => ({
  requests: 0,
  successes: 0,
  failures: 0,
  cacheHits: 0,
  rateLimits: 0,
});

const state: AnalyticsState = {
  optimizeRoute: createRouteCounters(),
  addressAutocomplete: createRouteCounters(),
  recentEvents: [],
  startedAt: new Date().toISOString(),
};

const routeKeyMap: Record<AnalyticsRoute, keyof Omit<AnalyticsState, "recentEvents" | "startedAt">> = {
  "optimize-route": "optimizeRoute",
  "address-autocomplete": "addressAutocomplete",
};

const sanitizeDetails = (
  details: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined => {
  if (!details) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(details).flatMap(([key, value]) => {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return [[key, value] as const];
    }

    return [];
  });

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
};

export const trackAnalyticsEvent = (
  route: AnalyticsRoute,
  outcome: AnalyticsOutcome,
  details?: Record<string, unknown>,
) => {
  const counters = state[routeKeyMap[route]];

  if (outcome === "request") {
    counters.requests += 1;
  } else if (outcome === "success") {
    counters.successes += 1;
  } else if (outcome === "failure") {
    counters.failures += 1;
  } else if (outcome === "cache-hit") {
    counters.cacheHits += 1;
  } else if (outcome === "rate-limit") {
    counters.rateLimits += 1;
  }

  const event: AnalyticsEvent = {
    route,
    outcome,
    timestamp: new Date().toISOString(),
    details: sanitizeDetails(details),
  };

  state.recentEvents.unshift(event);
  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents.length = MAX_RECENT_EVENTS;
  }

  console.info(
    JSON.stringify({
      scope: "analytics",
      ...event,
    }),
  );
};

export const getAnalyticsSnapshot = () => ({
  startedAt: state.startedAt,
  optimizeRoute: { ...state.optimizeRoute },
  addressAutocomplete: { ...state.addressAutocomplete },
  recentEvents: [...state.recentEvents],
});
