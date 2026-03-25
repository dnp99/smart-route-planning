const isEnabled = (value: string | boolean | undefined) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

export const isIlsOptimizerEnabled = () => isEnabled(import.meta.env.VITE_ENABLE_ILS_OPTIMIZER);

export const resolveOptimizeRoutePath = () =>
  isIlsOptimizerEnabled() ? "/api/optimize-route/v3" : "/api/optimize-route/v2";
