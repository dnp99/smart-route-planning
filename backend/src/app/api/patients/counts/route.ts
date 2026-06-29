import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { countPatientsByStateForNurse } from "../../../../lib/patients/patientRepository";

const CORS = {
  methods: "GET, OPTIONS",
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

// Per-state client counts for the Clients-page tabs.
export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, CORS);
    const auth = await requireAuth(request);
    const counts = await countPatientsByStateForNurse(auth.nurseId);
    return NextResponse.json(counts, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load client counts.", corsHeaders);
  }
}
