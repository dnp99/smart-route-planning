// The ILS optimizer (v3) is the only route-optimization engine. The legacy v2
// endpoint and the VITE_ENABLE_ILS_OPTIMIZER feature flag have been removed.
export const resolveOptimizeRoutePath = () => "/api/optimize-route/v3";
