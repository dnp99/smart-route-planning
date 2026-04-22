import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toRecurringVisitTemplateDto } from "../../../../lib/recurrence/recurrenceDto";
import {
  deleteRecurringVisitTemplateForNurse,
  updateRecurringVisitTemplateForNurse,
} from "../../../../lib/recurrence/recurrenceRepository";
import { validateUpdateRecurringVisitTemplatePayload } from "../../../../lib/recurrence/recurrenceValidation";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
};

const resolveTemplateId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const templateId = params.id?.trim();

  if (!templateId) {
    throw new HttpError(400, "Template id is required.");
  }

  return templateId;
};

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, DELETE, OPTIONS",
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
      methods: "PATCH, DELETE, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const templateId = await resolveTemplateId(context);
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

    const payload = validateUpdateRecurringVisitTemplatePayload(body);
    const updated = await updateRecurringVisitTemplateForNurse(auth.nurseId, templateId, payload);
    if (!updated) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "recurring_templates.update",
        resourceType: "recurring_visit_template",
        resourceId: templateId,
        outcome: "denied",
        metadata: { reason: "not_found" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });

      return NextResponse.json(
        { error: "Recurring visit template not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "recurring_templates.update",
      resourceType: "recurring_visit_template",
      resourceId: updated.id,
      outcome: "success",
      metadata: { changedFields: Object.keys(payload).sort() },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toRecurringVisitTemplateDto(updated), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to update recurring visit template.", corsHeaders);
  }
}

export async function DELETE(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, DELETE, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const templateId = await resolveTemplateId(context);
    const auth = await requireAuth(request);
    const deleted = await deleteRecurringVisitTemplateForNurse(auth.nurseId, templateId);
    if (!deleted) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "recurring_templates.delete",
        resourceType: "recurring_visit_template",
        resourceId: templateId,
        outcome: "denied",
        metadata: { reason: "not_found" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });

      return NextResponse.json(
        { error: "Recurring visit template not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "recurring_templates.delete",
      resourceType: "recurring_visit_template",
      resourceId: deleted.id,
      outcome: "success",
      metadata: {},
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json({ deleted: true, id: deleted.id }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete recurring visit template.", corsHeaders);
  }
}
