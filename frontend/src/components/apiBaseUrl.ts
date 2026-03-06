type NavigateEasyWindow = Window & {
  __NAVIGATE_EASY_API_BASE_URL__?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const normalizeBaseUrl = (value: string | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, '');
  return trimmedValue || null;
};

export const resolveApiBaseUrl = () => {
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  const configuredBaseUrl = normalizeBaseUrl(
    (window as NavigateEasyWindow).__NAVIGATE_EASY_API_BASE_URL__,
  );
  return configuredBaseUrl || DEFAULT_API_BASE_URL;
};
