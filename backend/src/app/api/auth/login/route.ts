import { NextResponse } from "next/server";
import {
  isLoginRequest,
  type AuthUser,
} from "../../../../../../shared/contracts";
import { verifyPassword } from "../../../../lib/auth/password";
import { signAccessToken } from "../../../../lib/auth/jwt";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { enforceLoginRateLimit } from "../requestGuards";
import {
  findNurseByEmail,
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

export async function OPTIONS(request: Request) {
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
}

export async function POST(request: Request) {
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

    if (!isLoginRequest(body)) {
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const nurse = await findNurseByEmail(email);
    if (!nurse || !nurse.isActive || !nurse.email || !nurse.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: corsHeaders },
      );
    }

    const passwordMatches = await verifyPassword(password, nurse.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: corsHeaders },
      );
    }

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
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to login.", corsHeaders);
  }
}
