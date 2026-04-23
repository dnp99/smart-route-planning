import { NextResponse } from "next/server";
import { parseOptimizeRouteV2Response } from "../../../../../../shared/contracts";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { recordOptimizationRun } from "../../../../lib/dashboard/dashboardRepository";
import { HttpError, toErrorResponse } from "../../../../lib/http";
import { optimizeRouteV2 } from "./optimizeRouteService";
import { parseAndValidateBody } from "./validation";
import {
  buildOptimizeRouteCorsHeaders,
  prepareOptimizeRouteRequest,
  toOptimizeRouteOptionsResponse,
} from "../routeShared";

export async function OPTIONS(request: Request) {
  return toOptimizeRouteOptionsResponse(request);
}

export async function POST(request: Request) {
  const corsHeaders = buildOptimizeRouteCorsHeaders(request);

  try {
    const prepared = await prepareOptimizeRouteRequest({
      request,
      corsHeaders,
      parseBody: parseAndValidateBody,
    });
    if (prepared instanceof NextResponse) {
      return prepared;
    }

    const { auth, googleMapsApiKey, parsedRequest } = prepared;
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
