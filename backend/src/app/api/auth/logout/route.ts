import { NextResponse } from "next/server";
import {
  readSessionIdFromCookieHeader,
  buildClearedSessionCookie,
} from "../../../../lib/auth/sessionCookie";
import { revokeAuthSession } from "../../../../lib/auth/sessionRepository";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { requireSecureAuthTransport } from "../requestGuards";

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

    const sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));
    if (sessionId) {
      await revokeAuthSession(sessionId);
    }

    return NextResponse.json(
      { loggedOut: true },
      {
        headers: {
          ...corsHeaders,
          "Set-Cookie": buildClearedSessionCookie(),
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to logout.", corsHeaders);
  }
}
