import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { toVisitInstanceDto } from "../../../lib/recurrence/recurrenceDto";
import { listVisitInstancesByNurseInRange } from "../../../lib/recurrence/recurrenceRepository";
import { validateVisitInstancesPlanningDate } from "../../../lib/recurrence/recurrenceValidation";

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
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
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const auth = await requireAuth(request);
    const requestUrl = new URL(request.url);
    const planningDate = validateVisitInstancesPlanningDate(
      requestUrl.searchParams.get("planningDate"),
    );
    const endDate = requestUrl.searchParams.get("endDate")?.trim() || planningDate;

    const instances = await listVisitInstancesByNurseInRange(
      auth.nurseId,
      planningDate,
      endDate,
    );
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "visit_instances.list",
      resourceType: "visit_instance",
      outcome: "success",
      metadata: { planningDate, endDate, resultCount: instances.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      { instances: instances.map(toVisitInstanceDto) },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to list visit instances.", corsHeaders);
  }
}
