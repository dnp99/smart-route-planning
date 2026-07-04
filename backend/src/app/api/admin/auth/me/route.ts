import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin/requireAdmin";
import { buildClearedAdminSessionCookie } from "../../../../../lib/admin/adminSessionCookie";
import { touchAdminSession } from "../../../../../lib/admin/adminSessionRepository";
import { buildCorsHeaders, toErrorResponse } from "../../../../../lib/http";
import { requireSecureAuthTransport } from "../../../auth/requestGuards";

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
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

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);

    let admin;
    try {
      admin = await requireAdmin(request);
    } catch {
      // Not signed in as admin — respond 401 and clear any stale cookie.
      return NextResponse.json(
        { error: "Unauthorized." },
        {
          status: 401,
          headers: { ...corsHeaders, "Set-Cookie": buildClearedAdminSessionCookie() },
        },
      );
    }

    await touchAdminSession(admin.sessionId);

    return NextResponse.json(
      {
        admin: {
          id: admin.adminId,
          email: admin.email,
          displayName: admin.displayName,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to resolve admin session.", corsHeaders);
  }
}
