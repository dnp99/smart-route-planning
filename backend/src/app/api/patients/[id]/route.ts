import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toPatientDto } from "../../../../lib/patients/patientDto";
import {
  deletePatientForNurse,
  updatePatientForNurse,
} from "../../../../lib/patients/patientRepository";
import { validateUpdatePatientPayload } from "../../../../lib/patients/patientValidation";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
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
    const corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, DELETE, OPTIONS",
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

export async function PATCH(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, DELETE, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const patientId = await resolvePatientId(context);
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

    const payload = validateUpdatePatientPayload(body);
    const updatedPatient = await updatePatientForNurse(auth.nurseId, patientId, payload);

    if (!updatedPatient) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "patients.update",
        resourceType: "patient",
        resourceId: patientId,
        outcome: "denied",
        metadata: { reason: "not_found" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });
      return NextResponse.json(
        { error: "Patient not found." },
        { status: 404, headers: corsHeaders },
      );
    }
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.update",
      resourceType: "patient",
      resourceId: updatedPatient.id,
      outcome: "success",
      metadata: { changedFields: Object.keys(payload).sort() },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(toPatientDto(updatedPatient), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to update patient.", corsHeaders);
  }
}

export async function DELETE(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "PATCH, DELETE, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const patientId = await resolvePatientId(context);
    const auth = await requireAuth(request);
    const deletedPatient = await deletePatientForNurse(auth.nurseId, patientId);

    if (!deletedPatient) {
      await logAuditEvent({
        actorNurseId: auth.nurseId,
        action: "patients.archive",
        resourceType: "patient",
        resourceId: patientId,
        outcome: "denied",
        metadata: { reason: "not_found" },
        ipAddress: resolveRequestIpAddress(request),
        userAgent: resolveRequestUserAgent(request),
      });
      return NextResponse.json(
        { error: "Patient not found." },
        { status: 404, headers: corsHeaders },
      );
    }
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "patients.archive",
      resourceType: "patient",
      resourceId: deletedPatient.id,
      outcome: "success",
      metadata: {},
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      {
        deleted: true,
        id: deletedPatient.id,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to delete patient.", corsHeaders);
  }
}
