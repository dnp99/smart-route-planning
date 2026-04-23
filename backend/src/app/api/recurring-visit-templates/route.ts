import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { toRecurringVisitTemplateDto } from "../../../lib/recurrence/recurrenceDto";
import {
  createRecurringVisitTemplateForNurse,
  listRecurringVisitTemplatesByNurse,
} from "../../../lib/recurrence/recurrenceRepository";
import { validateCreateRecurringVisitTemplatePayload } from "../../../lib/recurrence/recurrenceValidation";

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const auth = await requireAuth(request);
    const requestUrl = new URL(request.url);
    const patientId = requestUrl.searchParams.get("patientId")?.trim() || undefined;

    const templates = await listRecurringVisitTemplatesByNurse(auth.nurseId, patientId);
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "recurring_templates.list",
      resourceType: "recurring_visit_template",
      outcome: "success",
      metadata: { templateCount: templates.length, filteredByClient: Boolean(patientId) },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      { templates: templates.map(toRecurringVisitTemplateDto) },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to list recurring visit templates.", corsHeaders);
  }
}

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

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

    const payload = validateCreateRecurringVisitTemplatePayload(body);
    const created = await createRecurringVisitTemplateForNurse(auth.nurseId, payload);
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "recurring_templates.create",
      resourceType: "recurring_visit_template",
      resourceId: created.id,
      outcome: "success",
      metadata: { dayCount: created.daysOfWeek.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toRecurringVisitTemplateDto(created), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create recurring visit template.", corsHeaders);
  }
}
