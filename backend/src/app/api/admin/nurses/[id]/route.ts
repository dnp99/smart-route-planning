import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin/requireAdmin";
import { logAdminAuditEvent } from "../../../../../lib/admin/adminAuditLogger";
import {
  getNurseProfile,
  listNurseActivity,
  listNursePatients,
} from "../../../../../lib/admin/adminDashboardRepository";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../../lib/http";
import { requireSecureAuthTransport } from "../../../auth/requestGuards";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
};

const resolveNurseId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const nurseId = params.id?.trim();
  if (!nurseId) {
    throw new HttpError(400, "Nurse id is required.");
  }
  return nurseId;
};

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

export async function GET(request: Request, context: ParamsContext) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    const admin = await requireAdmin(request);
    const nurseId = await resolveNurseId(context);

    const nurse = await getNurseProfile(nurseId);
    if (!nurse) {
      return NextResponse.json(
        { error: "Nurse not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    const [nursePatients, activity] = await Promise.all([
      listNursePatients(nurseId),
      listNurseActivity(nurseId),
    ]);

    // This view exposes patient PHI (names/addresses), so record the admin's
    // access. Metadata carries only the scope (which nurse, how many clients),
    // never the PHI itself.
    void logAdminAuditEvent({
      actorAdminId: admin.adminId,
      action: "admin.nurse.view",
      resourceType: "nurse",
      resourceId: nurseId,
      outcome: "success",
      metadata: { patientCount: nursePatients.length, activityCount: activity.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(
      {
        nurse: {
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          isActive: nurse.isActive,
          mustChangePassword: nurse.mustChangePassword,
          homeAddress: nurse.homeAddress,
          createdAt: nurse.createdAt.toISOString(),
          lastLoginAt: nurse.lastLoginAt ? nurse.lastLoginAt.toISOString() : null,
        },
        patients: nursePatients.map((patient) => ({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          address: patient.address,
          isActive: patient.isActive,
          archivedAt: patient.archivedAt ? patient.archivedAt.toISOString() : null,
          createdAt: patient.createdAt.toISOString(),
        })),
        activity: activity.map((event) => ({
          id: event.id,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          outcome: event.outcome,
          metadata: event.metadata,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          createdAt: event.createdAt.toISOString(),
        })),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load nurse detail.", corsHeaders);
  }
}
