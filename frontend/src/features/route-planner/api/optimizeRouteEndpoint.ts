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

declare global {
  interface ImportMetaEnv {
    readonly VITE_ENABLE_ILS_OPTIMIZER?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const readIlsOptimizerFlag = () => {
  const processValue = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.VITE_ENABLE_ILS_OPTIMIZER;

  if (typeof processValue === "string") {
    return processValue;
  }

  return import.meta.env.VITE_ENABLE_ILS_OPTIMIZER;
};

export const isIlsOptimizerEnabled = () => isEnabled(readIlsOptimizerFlag());

export const resolveOptimizeRoutePath = () =>
  isIlsOptimizerEnabled() ? "/api/optimize-route/v3" : "/api/optimize-route/v2";
