import { afterEach, describe, expect, it } from "vitest";
import {
  buildAdminSessionCookie,
  buildClearedAdminSessionCookie,
  getAdminSessionCookieName,
  readAdminSessionIdFromCookieHeader,
} from "./adminSessionCookie";

describe("adminSessionCookie", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("adds Secure + SameSite=None in production", () => {
    process.env.NODE_ENV = "production";
    expect(buildAdminSessionCookie("s1")).toContain("Secure");
    expect(buildAdminSessionCookie("s1")).toContain("SameSite=None");
    expect(buildClearedAdminSessionCookie()).toContain("Secure");
  });

  it("returns null when the cookie value cannot be decoded", () => {
    // A malformed percent-escape makes decodeURIComponent throw.
    expect(readAdminSessionIdFromCookieHeader("routefy_admin_session=%E0%A4%A")).toBeNull();
  });

  it("uses a distinct cookie name from the nurse session", () => {
    expect(getAdminSessionCookieName()).toBe("routefy_admin_session");
  });

  it("builds an HttpOnly, path-scoped session cookie", () => {
    const cookie = buildAdminSessionCookie("admin-session-1");
    expect(cookie).toContain("routefy_admin_session=admin-session-1");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=");
  });

  it("clears the cookie with Max-Age=0", () => {
    expect(buildClearedAdminSessionCookie()).toContain("routefy_admin_session=;");
    expect(buildClearedAdminSessionCookie()).toContain("Max-Age=0");
  });

  it("reads the admin session id from a cookie header", () => {
    expect(
      readAdminSessionIdFromCookieHeader("other=1; routefy_admin_session=abc-123; more=2"),
    ).toBe("abc-123");
  });

  it("ignores a nurse session cookie", () => {
    expect(readAdminSessionIdFromCookieHeader("careflow_session=nurse-1")).toBeNull();
  });

  it("returns null for a missing or empty cookie header", () => {
    expect(readAdminSessionIdFromCookieHeader(null)).toBeNull();
    expect(readAdminSessionIdFromCookieHeader("routefy_admin_session=")).toBeNull();
  });
});
