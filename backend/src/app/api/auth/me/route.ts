import { NextResponse } from "next/server";
import { type AuthUser } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { findNurseById } from "../../../../lib/patients/patientRepository";

const toAuthUser = (value: {
  id: string;
  email: string;
  displayName: string;
}): AuthUser => ({
  id: value.id,
  email: value.email,
  displayName: value.displayName,
});

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
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
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json({ user: toAuthUser(nurse) }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to resolve current user.", corsHeaders);
  }
}
