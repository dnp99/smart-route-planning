import { NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../../lib/audit/requestAuditContext";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../../lib/http";
import { toPatientDto } from "../../../../../lib/patients/patientDto";
import { restorePatientForNurse } from "../../../../../lib/patients/patientRepository";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
};

const CORS = {
  methods: "POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization",
  originPolicy: "strict" as const,
};

const resolvePatientId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const patientId = params.id?.trim();
  if (!patientId) {
    throw new HttpError(400, "Patient id is required.");
  }
  return patientId;
};

export async function OPTIONS(request: Request) {
  try {
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request, CORS) });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

// Restore an archived client back to Active (only while still within the
// archived-visibility window).
export async function POST(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, CORS);
    const patientId = await resolvePatientId(context);
    const auth = await requireAuth(request);

    const restored = await restorePatientForNurse(auth.nurseId, patientId);
    if (!restored) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "patients.restore",
        resourceType: "patient",
        resourceId: patientId,
        outcome: "denied",
        metadata: { reason: "not_found_or_expired" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });
      return NextResponse.json(
        { error: "Client not found or no longer restorable." },
        { status: 404, headers: corsHeaders },
      );
    }

    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.restore",
      resourceType: "patient",
      resourceId: restored.id,
      outcome: "success",
      metadata: {},
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toPatientDto(restored), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to restore client.", corsHeaders);
  }
}
