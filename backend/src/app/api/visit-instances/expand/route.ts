import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toVisitInstanceDto } from "../../../../lib/recurrence/recurrenceDto";
import { expandVisitInstancesForNurse } from "../../../../lib/recurrence/recurrenceRepository";
import { validateExpandVisitInstancesPayload } from "../../../../lib/recurrence/recurrenceValidation";

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
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

    const payload = validateExpandVisitInstancesPayload(body);
    const result = await expandVisitInstancesForNurse(auth.nurseId, payload);
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "visit_instances.expand",
      resourceType: "visit_instance",
      outcome: "success",
      metadata: {
        startDate: payload.startDate,
        endDate: payload.endDate,
        createdCount: result.createdCount,
      },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      {
        createdCount: result.createdCount,
        instances: result.instances.map(toVisitInstanceDto),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to expand visit instances.", corsHeaders);
  }
}
