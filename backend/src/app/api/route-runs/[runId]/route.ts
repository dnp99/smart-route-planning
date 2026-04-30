import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { getDb } from "../../../../db";
import { routeOptimizationRuns } from "../../../../db/schema";

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });

    const auth = await requireAuth(request);
    const { runId } = await params;

    if (!runId || typeof runId !== "string" || runId.trim().length === 0) {
      throw new HttpError(400, "runId is required.");
    }

    const [row] = await getDb()
      .select()
      .from(routeOptimizationRuns)
      .where(
        and(
          eq(routeOptimizationRuns.id, runId),
          eq(routeOptimizationRuns.nurseId, auth.nurseId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new HttpError(404, "Route run not found.");
    }

    if (row.endpointVersion !== "v3") {
      throw new HttpError(422, "Saved result replay is only supported for v3 runs.");
    }

    if (!row.resultPayload) {
      throw new HttpError(404, "No saved result payload found for this run.");
    }

    const run = {
      id: row.id,
      planningDate: row.planningDate,
      createdAt: row.createdAt.toISOString(),
      endpointVersion: row.endpointVersion,
      optimizationObjective: row.optimizationObjective ?? null,
      scheduledVisitCount: row.scheduledVisitCount,
      unscheduledVisitCount: row.unscheduledVisitCount,
      algorithmVersion: row.algorithmVersion,
      requestPayload: row.requestPayload,
      resultPayload: row.resultPayload,
    };

    return NextResponse.json({ run }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load route run.", corsHeaders);
  }
}
