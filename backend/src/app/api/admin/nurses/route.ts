import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin/requireAdmin";
import { listNursesWithSummary } from "../../../../lib/admin/adminDashboardRepository";
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

    const nurses = await listNursesWithSummary();

    return NextResponse.json(
      {
        nurses: nurses.map((nurse) => ({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          isActive: nurse.isActive,
          mustChangePassword: nurse.mustChangePassword,
          createdAt: nurse.createdAt.toISOString(),
          lastLoginAt: nurse.lastLoginAt ? nurse.lastLoginAt.toISOString() : null,
          lastActivityAt: nurse.lastActivityAt ? nurse.lastActivityAt.toISOString() : null,
          activePatientCount: nurse.activePatientCount,
        })),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load nurses.", corsHeaders);
  }
}
