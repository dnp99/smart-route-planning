import { NextResponse } from "next/server";
import { parseDashboardSummaryResponse } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { getDashboardSummaryForNurse } from "../../../../lib/dashboard/dashboardRepository";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { findNurseById } from "../../../../lib/patients/patientRepository";

const resolveTimezone = (value: string | null): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "UTC";
  }

  const timezone = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return timezone;
};

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });

    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const timezone = resolveTimezone(url.searchParams.get("timezone"));

    const summary = await getDashboardSummaryForNurse({ nurseId: auth.nurseId, timezone });
    const parsed = parseDashboardSummaryResponse(summary);
    if (!parsed) {
      throw new HttpError(500, "Failed to shape dashboard summary response.");
    }
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "dashboard.summary",
      resourceType: "dashboard",
      outcome: "success",
      metadata: { timezone },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(parsed, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load dashboard summary.", corsHeaders);
  }
}
