import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toVisitInstanceDto } from "../../../../lib/recurrence/recurrenceDto";
import { updateVisitInstanceForNurse } from "../../../../lib/recurrence/recurrenceRepository";
import { validateUpdateVisitInstancePayload } from "../../../../lib/recurrence/recurrenceValidation";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
};

const resolveInstanceId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const instanceId = params.id?.trim();

  if (!instanceId) {
    throw new HttpError(400, "Visit instance id is required.");
  }

  return instanceId;
};

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function PATCH(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const instanceId = await resolveInstanceId(context);
    const auth = await requireAuth(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    const payload = validateUpdateVisitInstancePayload(body);
    const updated = await updateVisitInstanceForNurse(auth.nurseId, instanceId, payload);
    if (!updated) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "visit_instances.update",
        resourceType: "visit_instance",
        resourceId: instanceId,
        outcome: "denied",
        metadata: { reason: "not_found" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });

      return NextResponse.json(
        { error: "Visit instance not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "visit_instances.update",
      resourceType: "visit_instance",
      resourceId: updated.id,
      outcome: "success",
      metadata: { changedFields: Object.keys(payload).sort() },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toVisitInstanceDto(updated), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to update visit instance.", corsHeaders);
  }
}
