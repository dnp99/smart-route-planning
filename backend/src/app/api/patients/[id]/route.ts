import { NextResponse } from "next/server";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { toPatientDto } from "../../../../lib/patients/patientDto";
import {
  deletePatientForNurse,
  updatePatientForNurse,
} from "../../../../lib/patients/patientRepository";
import { resolveNurseContext } from "../../../../lib/patients/nurseContext";
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
      originPolicy: "strict",
    });

    const patientId = await resolvePatientId(context);
    const nurseContext = await resolveNurseContext();

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
    const updatedPatient = await updatePatientForNurse(nurseContext.nurseId, patientId, payload);

    if (!updatedPatient) {
      return NextResponse.json(
        { error: "Patient not found." },
        { status: 404, headers: corsHeaders },
      );
    }

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
      originPolicy: "strict",
    });

    const patientId = await resolvePatientId(context);
    const nurseContext = await resolveNurseContext();
    const deletedPatient = await deletePatientForNurse(nurseContext.nurseId, patientId);

    if (!deletedPatient) {
      return NextResponse.json(
        { error: "Patient not found." },
        { status: 404, headers: corsHeaders },
      );
    }

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
