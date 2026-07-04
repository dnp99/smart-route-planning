import { NextResponse } from "next/server";
import { isLoginRequest } from "../../../../../../../shared/contracts";
import { verifyPassword } from "../../../../../lib/auth/password";
import { buildAdminSessionCookie } from "../../../../../lib/admin/adminSessionCookie";
import { createAdminSession } from "../../../../../lib/admin/adminSessionRepository";
import { findAdminByEmail, updateAdminLastLoginAt } from "../../../../../lib/admin/adminRepository";
import { logAdminAuditEvent } from "../../../../../lib/admin/adminAuditLogger";
import { buildCorsHeaders, toErrorResponse } from "../../../../../lib/http";
import { enforceLoginRateLimit, requireSecureAuthTransport } from "../../../auth/requestGuards";

const resolveIpAddress = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
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
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await enforceLoginRateLimit(request);
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!isLoginRequest(body)) {
      await enforceLoginRateLimit(request);
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;
    await enforceLoginRateLimit(request, email);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Login payload must include email and password." },
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = await findAdminByEmail(email);
    // Generic 401 for both unknown email and wrong password — never disclose
    // which. A known-but-inactive admin is treated the same.
    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: corsHeaders },
      );
    }

    const passwordMatches = await verifyPassword(password, admin.passwordHash);
    if (!passwordMatches) {
      logAdminAuditEvent({
        actorAdminId: admin.id,
        action: "admin.login",
        resourceType: "admin",
        resourceId: admin.id,
        outcome: "denied",
        ipAddress: resolveIpAddress(request),
        userAgent: request.headers.get("user-agent"),
      });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: corsHeaders },
      );
    }

    await updateAdminLastLoginAt(admin.id);

    const createdSession = await createAdminSession({
      adminId: admin.id,
      ipAddress: resolveIpAddress(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (!createdSession) {
      throw new Error("Unable to create admin session.");
    }

    logAdminAuditEvent({
      actorAdminId: admin.id,
      action: "admin.login",
      resourceType: "admin",
      resourceId: admin.id,
      outcome: "success",
      ipAddress: resolveIpAddress(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        admin: {
          id: admin.id,
          email: admin.email,
          displayName: admin.displayName,
        },
      },
      {
        headers: {
          ...corsHeaders,
          "Set-Cookie": buildAdminSessionCookie(createdSession.id),
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to login.", corsHeaders);
  }
}
