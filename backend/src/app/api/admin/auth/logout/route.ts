import { NextResponse } from "next/server";
import {
  buildClearedAdminSessionCookie,
  readAdminSessionIdFromCookieHeader,
} from "../../../../../lib/admin/adminSessionCookie";
import { revokeAdminSession } from "../../../../../lib/admin/adminSessionRepository";
import { buildCorsHeaders, toErrorResponse } from "../../../../../lib/http";
import { requireSecureAuthTransport } from "../../../auth/requestGuards";

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

    const sessionId = readAdminSessionIdFromCookieHeader(request.headers.get("cookie"));
    if (sessionId) {
      await revokeAdminSession(sessionId);
    }

    return NextResponse.json(
      { loggedOut: true },
      {
        headers: {
          ...corsHeaders,
          "Set-Cookie": buildClearedAdminSessionCookie(),
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to logout.", corsHeaders);
  }
}
