import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { toPatientDto } from "../../../lib/patients/patientDto";
import {
  createPatientForNurse,
  listPatientsByNurse,
} from "../../../lib/patients/patientRepository";
import { validateCreatePatientPayload } from "../../../lib/patients/patientValidation";

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
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
    const query = requestUrl.searchParams.get("query") ?? "";

    const patients = await listPatientsByNurse(auth.nurseId, query);
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.list",
      resourceType: "patient",
      outcome: "success",
      metadata: { queryLength: query.trim().length, resultCount: patients.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });
    return NextResponse.json(
      {
        patients: patients.map(toPatientDto),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to list patients.", corsHeaders);
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

    const payload = validateCreatePatientPayload(body);
    const created = await createPatientForNurse(auth.nurseId, payload);
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.create",
      resourceType: "patient",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        visitWindowCount: Array.isArray(payload.visitWindows) ? payload.visitWindows.length : 0,
      },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toPatientDto(created), { status: 201, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to create patient.", corsHeaders);
  }
}
