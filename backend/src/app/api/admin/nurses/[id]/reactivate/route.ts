import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin/requireAdmin";
import { logAdminAuditEvent } from "../../../../../../lib/admin/adminAuditLogger";
import { setNurseActive } from "../../../../../../lib/admin/adminNurseRepository";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../../../lib/http";
import { requireSecureAuthTransport } from "../../../../auth/requestGuards";

type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

const resolveNurseId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const nurseId = params.id?.trim();
  if (!nurseId) {
    throw new HttpError(400, "Nurse id is required.");
  }
  return nurseId;
};

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function POST(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    const admin = await requireAdmin(request);
    const nurseId = await resolveNurseId(context);

    const nurse = await setNurseActive(nurseId, true);
    if (!nurse) {
      return NextResponse.json(
        { error: "Nurse not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    void logAdminAuditEvent({
      actorAdminId: admin.adminId,
      action: "admin.nurse.reactivate",
      resourceType: "nurse",
      resourceId: nurseId,
      outcome: "success",
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      { nurse: { id: nurse.id, isActive: nurse.isActive } },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to reactivate nurse.", corsHeaders);
  }
}
