import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin/requireAdmin";
import { listNurseRouteRuns } from "../../../../../../lib/admin/adminDashboardRepository";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../../../lib/http";
import { requireSecureAuthTransport } from "../../../../auth/requestGuards";

type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

const resolveNurseId = async (context: ParamsContext) => {
  const params = await Promise.resolve(context.params);
  const nurseId = params.id?.trim();
  if (!nurseId) {
    throw new HttpError(400, "Nurse id is required.");
  }
  return nurseId;
};

const resolveBeforeCursor = (request: Request): Date | null => {
  const raw = new URL(request.url).searchParams.get("before");
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    throw new HttpError(400, "before must be an ISO-8601 timestamp.");
  }
  return parsed;
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
    await requireAdmin(request);
    const nurseId = await resolveNurseId(context);
    const before = resolveBeforeCursor(request);

    // Aggregate route-run history only (counts/durations/dates) — no PHI.
    const { runs, nextCursor, hasMore } = await listNurseRouteRuns(nurseId, { before });

    return NextResponse.json(
      {
        runs: runs.map((run) => ({
          id: run.id,
          planningDate: run.planningDate,
          createdAt: run.createdAt.toISOString(),
          requestedVisitCount: run.requestedVisitCount,
          scheduledVisitCount: run.scheduledVisitCount,
          unscheduledVisitCount: run.unscheduledVisitCount,
          onTimeVisitCount: run.onTimeVisitCount,
          totalDurationSeconds: run.totalDurationSeconds,
          totalDistanceMeters: run.totalDistanceMeters,
          optimizationObjective: run.optimizationObjective,
        })),
        nextCursor,
        hasMore,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load route runs.", corsHeaders);
  }
}
