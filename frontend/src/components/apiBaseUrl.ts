type NavigateEasyWindow = Window & {
  __NAVIGATE_EASY_API_BASE_URL__?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const resolveApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  const configuredBaseUrl = (window as NavigateEasyWindow).__NAVIGATE_EASY_API_BASE_URL__;
  if (typeof configuredBaseUrl !== 'string') {
    return DEFAULT_API_BASE_URL;
  }

  const trimmedBaseUrl = configuredBaseUrl.trim();
  return trimmedBaseUrl || DEFAULT_API_BASE_URL;
};
