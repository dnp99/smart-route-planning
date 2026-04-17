import { NextResponse } from "next/server";
import { parseOptimizeRouteV2Response } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { recordOptimizationRun } from "../../../../lib/dashboard/dashboardRepository";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { enforceOptimizeRouteRateLimit, requireOptimizeRouteApiKey } from "../requestGuards";
import { optimizeRouteV2 } from "./optimizeRouteService";
import { parseAndValidateBody } from "./validation";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization, x-optimize-route-key",
      originPolicy: "strict",
    }),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request, {
    methods: "POST, OPTIONS",
    allowedHeaders: "Content-Type, Authorization, x-optimize-route-key",
    originPolicy: "strict",
  });

  try {
    const auth = await requireAuth(request);
    requireOptimizeRouteApiKey(request);
    enforceOptimizeRouteRateLimit(request);

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!googleMapsApiKey) {
      return NextResponse.json(
        { error: "Server is missing GOOGLE_MAPS_API_KEY configuration." },
        { status: 500, headers: corsHeaders },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: corsHeaders },
      );
    }

    const parsedRequest = parseAndValidateBody(body);
    const result = await optimizeRouteV2(parsedRequest, googleMapsApiKey);
    const parsedResponse = parseOptimizeRouteV2Response(result);
    if (!parsedResponse) {
      throw new HttpError(500, "Failed to shape optimize-route v2 response.");
    }

    try {
      await recordOptimizationRun({
        nurseId: auth.nurseId,
        endpointVersion: "v2",
        request: parsedRequest,
        result,
      });
    } catch (error) {
      console.error("Failed to persist optimize-route v2 history.", error);
    }
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "optimize.v2",
      resourceType: "route_optimization",
      outcome: "success",
      metadata: {
        planningDate: parsedRequest.planningDate,
        visitCount: parsedRequest.visits.length,
        scheduledCount: result.orderedStops.flatMap((stop) => stop.tasks).length,
      },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(parsedResponse, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to optimize route.", corsHeaders);
  }
}
