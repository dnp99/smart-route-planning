import { afterEach, describe, expect, it, vi } from "vitest";
import { logAuthAuditEvent } from "./auditLogger";

describe("auditLogger", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("does not emit auth audit logs in test environment", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "test";

    logAuthAuditEvent({
      action: "login",
      outcome: "success",
      email: "nurse@example.com",
      clientKey: "203.0.113.1",
    });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("redacts sensitive fields in emitted auth audit logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    logAuthAuditEvent({
      action: "login",
      outcome: "invalid_credentials",
      email: "Nurse@example.com",
      clientKey: "203.0.113.1",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.event).toBe("auth.login");
    expect(payload.outcome).toBe("invalid_credentials");
    expect(payload.email).toBe("n***@example.com");
    expect(payload.client).toBe("203.0.x.x");
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it("masks malformed emails and non-ip client identifiers", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    logAuthAuditEvent({
      action: "login",
      outcome: "error",
      email: "not-an-email",
      clientKey: "custom-client-key",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.email).toBe("***");
    expect(payload.client).toBe("***");
  });

  it("keeps anonymous client keys anonymous and handles missing email", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    logAuthAuditEvent({
      action: "login",
      outcome: "invalid_payload",
      clientKey: "anonymous",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.email).toBeUndefined();
    expect(payload.client).toBe("anonymous");
  });

  it("masks ipv6 addresses by keeping only the first two segments", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    logAuthAuditEvent({
      action: "login",
      outcome: "invalid_credentials",
      email: "nurse@example.com",
      clientKey: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.client).toBe("2001:0db8:x:x");
  });
});
