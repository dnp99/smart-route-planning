// Admin session cookie helpers. Deliberately a distinct cookie name and module
// from the nurse session (careflow_session) so the two auth surfaces stay fully
// isolated: a nurse cookie can never resolve an admin session and vice-versa.
const ADMIN_SESSION_COOKIE_NAME = "routefy_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const isProduction = () => process.env.NODE_ENV === "production";
const getSessionSameSite = () => (isProduction() ? "None" : "Lax");

export const getAdminSessionCookieName = () => ADMIN_SESSION_COOKIE_NAME;

export const getAdminSessionMaxAgeSeconds = () => ADMIN_SESSION_MAX_AGE_SECONDS;

export const buildAdminSessionCookie = (sessionId: string) => {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getSessionSameSite()}`,
    `Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}`,
  ];

  if (isProduction()) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const buildClearedAdminSessionCookie = () => {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
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

export const readAdminSessionIdFromCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());
  for (const segment of segments) {
    if (!segment.startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`)) {
      continue;
    }

    const encodedValue = segment.slice(ADMIN_SESSION_COOKIE_NAME.length + 1).trim();
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
