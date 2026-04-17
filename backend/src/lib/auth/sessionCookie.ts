const SESSION_COOKIE_NAME = "careflow_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const isProduction = () => process.env.NODE_ENV === "production";
const getSessionSameSite = () => (isProduction() ? "None" : "Lax");

export const getSessionCookieName = () => SESSION_COOKIE_NAME;

export const getSessionMaxAgeSeconds = () => SESSION_MAX_AGE_SECONDS;

export const buildSessionCookie = (sessionId: string) => {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getSessionSameSite()}`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];

  if (isProduction()) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const buildClearedSessionCookie = () => {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getSessionSameSite()}`,
    "Max-Age=0",
  ];

  if (isProduction()) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const readSessionIdFromCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());
  for (const segment of segments) {
    if (!segment.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      continue;
    }

    const encodedValue = segment.slice(SESSION_COOKIE_NAME.length + 1).trim();
    if (!encodedValue) {
      return null;
    }

    try {
      return decodeURIComponent(encodedValue);
    } catch {
      return null;
    }
  }

  return null;
};
