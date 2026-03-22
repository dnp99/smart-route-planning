import { NextResponse } from "next/server";
import { isUpdatePasswordRequest } from "../../../../../../shared/contracts";
import { hashPassword, verifyPassword } from "../../../../lib/auth/password";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { findNurseById, updateNursePasswordHash } from "../../../../lib/patients/patientRepository";
import { enforceUpdatePasswordRateLimit } from "../../../../lib/rateLimit/authUpdatePasswordRateLimit";
import { requireSecureAuthTransport, resolveAuthClientKey } from "../requestGuards";

const MIN_PASSWORD_LENGTH = 8;

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
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

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
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

    enforceUpdatePasswordRateLimit({
      nurseId: auth.nurseId,
      clientKey: resolveAuthClientKey(request),
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON.");
    }

    if (!isUpdatePasswordRequest(body)) {
      throw new HttpError(400, "Request must include currentPassword and newPassword.");
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword.trim()) {
      throw new HttpError(400, "Current password is required.");
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    if (currentPassword === newPassword) {
      throw new HttpError(400, "New password must differ from current password.");
    }

    const isValid = await verifyPassword(currentPassword, nurse.passwordHash);
    if (!isValid) {
      throw new HttpError(403, "Current password is incorrect.");
    }

    const newPasswordHash = await hashPassword(newPassword);
    const updatedNurse = await updateNursePasswordHash(auth.nurseId, newPasswordHash);
    if (!updatedNurse) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to update password.", corsHeaders);
  }
}
