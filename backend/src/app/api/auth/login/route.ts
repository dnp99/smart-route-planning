import { NextResponse } from "next/server";
import {
  isLoginRequest,
  type AuthUser,
  type WeeklyWorkingHours,
} from "../../../../../../shared/contracts";
import { logAuthAuditEvent } from "../../../../lib/auth/auditLogger";
import { verifyPassword } from "../../../../lib/auth/password";
import { signAccessToken } from "../../../../lib/auth/jwt";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import {
  enforceLoginRateLimit,
  requireSecureAuthTransport,
  resolveAuthClientKey,
} from "../requestGuards";
import {
  findNurseByEmail,
  updateNurseLastLoginAt,
} from "../../../../lib/patients/patientRepository";

const toAuthUser = (value: {
  id: string;
  email: string;
  displayName: string;
  homeAddress?: string | null;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
  optimizationObjective?: string | null;
}): AuthUser => ({
  id: value.id,
  email: value.email,
  displayName: value.displayName,
  homeAddress: value.homeAddress ?? null,
  workingHours: value.workingHours ?? null,
  breakGapThresholdMinutes: value.breakGapThresholdMinutes ?? null,
  optimizationObjective:
    value.optimizationObjective === "time" || value.optimizationObjective === "distance"
      ? value.optimizationObjective
      : null,
});

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
  const clientKey = resolveAuthClientKey(request);
  let attemptedEmail: string | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await enforceLoginRateLimit(request);
      logAuthAuditEvent({
        action: "login",
        outcome: "invalid_json",
        clientKey,
      });
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!isLoginRequest(body)) {
      await enforceLoginRateLimit(request);
      logAuthAuditEvent({
        action: "login",
        outcome: "invalid_payload",
        clientKey,
      });
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;
    attemptedEmail = email;
    await enforceLoginRateLimit(request, email);

    if (!email || !password) {
      logAuthAuditEvent({
        action: "login",
        outcome: "invalid_payload",
        email,
        clientKey,
      });
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const nurse = await findNurseByEmail(email);
    if (!nurse || !nurse.isActive) {
      logAuthAuditEvent({
        action: "login",
        outcome: "invalid_credentials",
        email,
        clientKey,
      });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: corsHeaders },
      );
    }

    const passwordMatches = await verifyPassword(password, nurse.passwordHash);
    if (!passwordMatches) {
      logAuthAuditEvent({
        action: "login",
        outcome: "invalid_credentials",
        email,
        clientKey,
      });
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

    logAuthAuditEvent({
      action: "login",
      outcome: "success",
      email,
      clientKey,
    });

    return NextResponse.json(
      {
        token,
        user: toAuthUser({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          homeAddress: nurse.homeAddress,
          workingHours: nurse.workingHours as WeeklyWorkingHours | null | undefined,
          breakGapThresholdMinutes: nurse.breakGapThresholdMinutes,
          optimizationObjective: nurse.optimizationObjective,
        }),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 429
    ) {
      logAuthAuditEvent({
        action: "login",
        outcome: "rate_limited",
        email: attemptedEmail,
        clientKey,
      });
    } else if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 426
    ) {
      logAuthAuditEvent({
        action: "login",
        outcome: "transport_rejected",
        email: attemptedEmail,
        clientKey,
      });
    } else {
      logAuthAuditEvent({
        action: "login",
        outcome: "error",
        email: attemptedEmail,
        clientKey,
      });
    }

    return toErrorResponse(error, "Failed to login.", corsHeaders);
  }
}
