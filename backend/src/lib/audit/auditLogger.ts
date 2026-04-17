import { getDb } from "../../db";
import { auditEvents } from "../../db/schema";

type AuditEventInput = {
  actorNurseId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: "success" | "error" | "denied";
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const logAuditEvent = async (event: AuditEventInput): Promise<void> => {
  try {
    await getDb()
      .insert(auditEvents)
      .values({
        actorNurseId: event.actorNurseId ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        outcome: event.outcome,
        metadata: event.metadata ?? {},
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Failed to write audit event", error);
    }
  }
};
