import { NextResponse } from "next/server";
import {
  isSignupRequest,
  type AuthUser,
} from "../../../../../../shared/contracts";
import { signAccessToken } from "../../../../lib/auth/jwt";
import { hashPassword } from "../../../../lib/auth/password";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { enforceLoginRateLimit } from "../requestGuards";
import {
  createNurseAccount,
  findNurseByEmail,
  NurseEmailConflictError,
  updateNurseLastLoginAt,
} from "../../../../lib/patients/patientRepository";

const toAuthUser = (value: {
  id: string;
  email: string;
  displayName: string;
}): AuthUser => ({
  id: value.id,
  email: value.email,
  displayName: value.displayName,
});

const validateSignupPayload = (body: unknown) => {
  if (!isSignupRequest(body)) {
    throw new HttpError(400, "Signup payload must include displayName, email, and password.");
  }

  const displayName = body.displayName.trim();
  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (!displayName || !email || !password) {
    throw new HttpError(400, "Signup payload must include displayName, email, and password.");
  }

  if (displayName.length > 120) {
    throw new HttpError(400, "Display name must be 120 characters or fewer.");
  }

  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }

  return {
    displayName,
    email,
    password,
  };
};

export const OPTIONS = async (request: Request) => {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
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
};

export const POST = async (request: Request) => {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    enforceLoginRateLimit(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    const payload = validateSignupPayload(body);
    const existingNurse = await findNurseByEmail(payload.email);
    if (existingNurse) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409, headers: corsHeaders },
      );
    }

    const passwordHash = await hashPassword(payload.password);
    const nurse = await createNurseAccount({
      displayName: payload.displayName,
      email: payload.email,
      passwordHash,
    });

    await updateNurseLastLoginAt(nurse.id);

    const token = await signAccessToken({
      nurseId: nurse.id,
      email: nurse.email,
    });

    return NextResponse.json(
      {
        token,
        user: toAuthUser({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
        }),
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    if (error instanceof NurseEmailConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: corsHeaders },
      );
    }

    return toErrorResponse(error, "Failed to sign up.", corsHeaders);
  }
};
