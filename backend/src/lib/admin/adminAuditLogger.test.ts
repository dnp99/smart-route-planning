import { beforeEach, describe, expect, it, vi } from "vitest";

const { logAuditEventMock } = vi.hoisted(() => ({ logAuditEventMock: vi.fn() }));
vi.mock("../audit/auditLogger", () => ({ logAuditEvent: logAuditEventMock }));

import { logAdminAuditEvent } from "./adminAuditLogger";

describe("logAdminAuditEvent", () => {
  beforeEach(() => logAuditEventMock.mockReset());

  it("forwards to the shared audit writer with the admin actor", () => {
    logAdminAuditEvent({
      actorAdminId: "a1",
      action: "admin.nurse.view",
      resourceType: "nurse",
      resourceId: "n1",
      outcome: "success",
      metadata: { patientCount: 2 },
      ipAddress: "1.2.3.4",
      userAgent: "UA",
    });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "a1",
        action: "admin.nurse.view",
        resourceId: "n1",
        metadata: { patientCount: 2 },
      }),
    );
  });

  it("defaults optional fields to null", () => {
    logAdminAuditEvent({
      actorAdminId: "a1",
      action: "admin.login",
      resourceType: "admin",
      outcome: "success",
    });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: null, ipAddress: null, userAgent: null }),
    );
  });
});
