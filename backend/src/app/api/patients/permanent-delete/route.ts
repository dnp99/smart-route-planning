import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { permanentlyDeletePatientsForNurse } from "../../../../lib/patients/patientRepository";

const CORS = {
  methods: "POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization",
  originPolicy: "strict" as const,
};

const parsePatientIds = (body: unknown): string[] | null => {
  if (typeof body !== "object" || body === null || !("patientIds" in body)) {
    return null;
  }
  const { patientIds } = body as { patientIds: unknown };
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return null;
  }
  if (!patientIds.every((id) => typeof id === "string" && id.length > 0)) {
    return null;
  }
  return [...new Set(patientIds as string[])];
};

export async function OPTIONS(request: Request) {
  try {
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request, CORS) });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, CORS);
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

    const patientIds = parsePatientIds(body);
    if (!patientIds) {
      return NextResponse.json(
        { error: "patientIds must be a non-empty array of client ids." },
        { status: 400, headers: corsHeaders },
      );
    }

    const deletedIds = await permanentlyDeletePatientsForNurse(auth.nurseId, patientIds);
    void logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.permanent_delete",
      resourceType: "patient",
      outcome: "success",
      metadata: { requestedCount: patientIds.length, deletedCount: deletedIds.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json({ deletedIds }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete clients.", corsHeaders);
  }
}
