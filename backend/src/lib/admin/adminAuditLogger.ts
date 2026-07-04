import { logAuditEvent } from "../audit/auditLogger";

type AdminAuditEventInput = {
  actorAdminId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: "success" | "error" | "denied";
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Thin wrapper over the shared audit writer that stamps the acting admin. Every
// admin action — including any PHI view — must flow through here so "who did/saw
// what" is answerable from the audit_events timeline. Never put raw PHI in
// metadata beyond the identifiers the event already concerns.
export const logAdminAuditEvent = (event: AdminAuditEventInput): Promise<void> =>
  logAuditEvent({
    actorAdminId: event.actorAdminId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId ?? null,
    outcome: event.outcome,
    metadata: event.metadata,
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
  });
