import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin/requireAdmin";
import { logAdminAuditEvent } from "../../../../../../lib/admin/adminAuditLogger";
import { resetNursePassword } from "../../../../../../lib/admin/adminNurseRepository";
import { generateTemporaryPassword } from "../../../../../../lib/admin/temporaryPassword";
import { hashPassword } from "../../../../../../lib/auth/password";
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

    // Generate the temp password server-side, hash it, and force a change on the
    // nurse's next login. The plaintext is returned to the admin exactly once —
    // it is never stored or logged.
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const nurse = await resetNursePassword(nurseId, passwordHash);
    if (!nurse) {
      return NextResponse.json(
        { error: "Nurse not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    void logAdminAuditEvent({
      actorAdminId: admin.adminId,
      action: "admin.nurse.password_reset",
      resourceType: "nurse",
      resourceId: nurseId,
      outcome: "success",
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json({ temporaryPassword }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to reset password.", corsHeaders);
  }
}
