type NavigateEasyWindow = Window & {
  __NAVIGATE_EASY_API_BASE_URL__?: string;
};

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const normalizeBaseUrl = (value: string | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, "");
  return trimmedValue || null;
};

export const resolveApiBaseUrl = () => {
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window === "undefined") {
    return DEFAULT_API_BASE_URL;
  }

  const configuredBaseUrl = normalizeBaseUrl(
    (window as NavigateEasyWindow).__NAVIGATE_EASY_API_BASE_URL__,
  );
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const browserHost = window.location.hostname.trim().toLowerCase();
  if (LOCAL_BROWSER_HOSTS.has(browserHost)) {
    return DEFAULT_API_BASE_URL;
  }

  return "";
};
