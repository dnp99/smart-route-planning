export type AuthSessionDeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

const BOT_PATTERN =
  /(bot|crawl|crawler|spider|slurp|facebookexternalhit|wget|curl|postmanruntime|insomnia)/i;
const TABLET_PATTERN = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i;
const MOBILE_PATTERN = /(mobi|iphone|ipod|android.*mobile|windows phone)/i;
const DESKTOP_PATTERN = /(macintosh|windows nt|x11|linux)/i;

export const resolveDeviceTypeFromUserAgent = (
  userAgent: string | null | undefined,
): AuthSessionDeviceType => {
  if (typeof userAgent !== "string") {
    return "unknown";
  }

  const normalized = userAgent.trim();
  if (!normalized) {
    return "unknown";
  }

  if (BOT_PATTERN.test(normalized)) {
    return "bot";
  }

  if (TABLET_PATTERN.test(normalized)) {
    return "tablet";
  }

  if (MOBILE_PATTERN.test(normalized)) {
    return "mobile";
  }

  if (DESKTOP_PATTERN.test(normalized)) {
    return "desktop";
  }

  return "unknown";
};
