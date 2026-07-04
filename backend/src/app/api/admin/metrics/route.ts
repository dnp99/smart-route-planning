import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin/requireAdmin";
import { getAdminMetrics } from "../../../../lib/admin/adminDashboardRepository";
import { buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { requireSecureAuthTransport } from "../../auth/requestGuards";

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
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    await requireAdmin(request);

    const metrics = await getAdminMetrics();

    return NextResponse.json({ metrics }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load metrics.", corsHeaders);
  }
}
