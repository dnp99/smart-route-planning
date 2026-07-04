import { describe, expect, it } from "vitest";
import {
  buildAdminSessionCookie,
  buildClearedAdminSessionCookie,
  getAdminSessionCookieName,
  readAdminSessionIdFromCookieHeader,
} from "./adminSessionCookie";

describe("adminSessionCookie", () => {
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
