import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toPatientDto } from "../../../../lib/patients/patientDto";
import {
  dismissStaleClientReviewForNurse,
  getStaleClientReviewForNurse,
} from "../../../../lib/patients/patientRepository";

const CORS = {
  methods: "GET, POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization",
  originPolicy: "strict" as const,
};

export async function OPTIONS(request: Request) {
  try {
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request, CORS) });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, CORS);
    const auth = await requireAuth(request);
    const review = await getStaleClientReviewForNurse(auth.nurseId);
    return NextResponse.json(
      {
        snoozedUntil: review.snoozedUntil,
        patients: review.patients.map(toPatientDto),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load stale clients.", corsHeaders);
  }
}

// "Keep all" — dismiss/snooze the stale-client review.
export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, CORS);
    const auth = await requireAuth(request);
    await dismissStaleClientReviewForNurse(auth.nurseId);
    void logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.stale_review.dismiss",
      resourceType: "patient",
      outcome: "success",
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to dismiss stale-client review.", corsHeaders);
  }
}
