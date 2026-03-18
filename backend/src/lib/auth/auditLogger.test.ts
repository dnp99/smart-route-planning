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
});
