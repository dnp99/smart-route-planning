import { NextResponse } from "next/server";
import { isUpdateMeRequest, type AuthUser } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { findNurseById, updateNurseHomeAddress } from "../../../../lib/patients/patientRepository";
import { requireSecureAuthTransport } from "../requestGuards";

const MAX_HOME_ADDRESS_LENGTH = 200;

const toAuthUser = (value: {
  id: string;
  email: string;
  displayName: string;
  homeAddress?: string | null;
}): AuthUser => ({
  id: value.id,
  email: value.email,
  displayName: value.displayName,
  homeAddress: value.homeAddress ?? null,
});

const validateAndNormalizeHomeAddress = (body: unknown) => {
  if (!isUpdateMeRequest(body)) {
    throw new HttpError(400, "Profile payload must include homeAddress.");
  }

  const homeAddress = body.homeAddress.trim();
  if (!homeAddress) {
    throw new HttpError(400, "Home address is required.");
  }

  if (homeAddress.length > MAX_HOME_ADDRESS_LENGTH) {
    throw new HttpError(400, "Home address must be 200 characters or fewer.");
  }

  return homeAddress;
};

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        user: toAuthUser({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          homeAddress: nurse.homeAddress,
        }),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to resolve current user.", corsHeaders);
  }
}

export async function PATCH(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON.");
    }

    const homeAddress = validateAndNormalizeHomeAddress(body);
    const updatedNurse = await updateNurseHomeAddress(auth.nurseId, homeAddress);
    if (!updatedNurse || !updatedNurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        user: toAuthUser({
          id: updatedNurse.id,
          email: updatedNurse.email,
          displayName: updatedNurse.displayName,
          homeAddress: updatedNurse.homeAddress,
        }),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to update current user.", corsHeaders);
  }
}
