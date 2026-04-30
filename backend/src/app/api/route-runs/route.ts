import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../lib/http";
import { getDb } from "../../../db";
import { routeOptimizationRuns } from "../../../db/schema";

const PLANNING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validatePlanningDate = (value: string | null): string => {
  if (!value || !PLANNING_DATE_RE.test(value.trim())) {
    throw new HttpError(400, "planningDate must be a valid YYYY-MM-DD date.");
  }
  return value.trim();
};

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

    const auth = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const planningDate = validatePlanningDate(searchParams.get("planningDate"));

    const rows = await getDb()
      .select({
        id: routeOptimizationRuns.id,
        planningDate: routeOptimizationRuns.planningDate,
        createdAt: routeOptimizationRuns.createdAt,
        endpointVersion: routeOptimizationRuns.endpointVersion,
        optimizationObjective: routeOptimizationRuns.optimizationObjective,
        scheduledVisitCount: routeOptimizationRuns.scheduledVisitCount,
        unscheduledVisitCount: routeOptimizationRuns.unscheduledVisitCount,
        algorithmVersion: routeOptimizationRuns.algorithmVersion,
      })
      .from(routeOptimizationRuns)
      .where(
        and(
          eq(routeOptimizationRuns.nurseId, auth.nurseId),
          eq(routeOptimizationRuns.planningDate, planningDate),
        ),
      )
      .orderBy(desc(routeOptimizationRuns.createdAt));

    const runs = rows.map((row) => ({
      id: row.id,
      planningDate: row.planningDate,
      createdAt: row.createdAt.toISOString(),
      endpointVersion: row.endpointVersion,
      optimizationObjective: row.optimizationObjective ?? null,
      scheduledVisitCount: row.scheduledVisitCount,
      unscheduledVisitCount: row.unscheduledVisitCount,
      algorithmVersion: row.algorithmVersion,
    }));

    return NextResponse.json({ runs }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load route runs.", corsHeaders);
  }
}
