import { NextResponse } from "next/server";
import { parseOptimizeRouteV2Response } from "../../../../../../shared/contracts";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { recordOptimizationRun } from "../../../../lib/dashboard/dashboardRepository";
import { HttpError, toErrorResponse } from "../../../../lib/http";
import {
  listScheduledVisitInstancesForOptimization,
  type VisitInstanceMeta,
} from "../../../../lib/recurrence/recurrenceRepository";
import { optimizeRouteV3 } from "./optimizeRouteService";
import { parseAndValidateBody } from "../v2/validation";
import {
  buildOptimizeRouteCorsHeaders,
  prepareOptimizeRouteRequest,
  toOptimizeRouteOptionsResponse,
} from "../routeShared";

const isEnabled = (value: string | undefined) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const parseShadowSampleRate = (value: string | undefined) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 1;
  }

  const parsed = Number(value);
  if (
    parsed !== parsed ||
    parsed === Number.POSITIVE_INFINITY ||
    parsed === Number.NEGATIVE_INFINITY
  ) {
    return 1;
  }

  return Math.max(0, Math.min(1, parsed));
};

const hashToUnitInterval = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};

const resolveRequestId = (request: Request) =>
  request.headers.get("x-request-id")?.trim() || crypto.randomUUID();

const shouldLogShadowComparison = (requestId: string) => {
  if (!isEnabled(process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE)) {
    return false;
  }

  const sampleRate = parseShadowSampleRate(process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE);
  return hashToUnitInterval(requestId) < sampleRate;
};

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
    let optimizerRequest = parsedRequest;
    let instanceMetaByVisitId: Map<string, VisitInstanceMeta> | undefined;
    if (process.env.DATABASE_URL?.trim()) {
      try {
        const { visits: scheduledInstanceVisits, instanceMetaByVisitId: meta } =
          await listScheduledVisitInstancesForOptimization(
            auth.nurseId,
            parsedRequest.planningDate,
          );
        if (scheduledInstanceVisits.length > 0) {
          if (parsedRequest.visits.length === 0) {
            optimizerRequest = {
              ...parsedRequest,
              visits: scheduledInstanceVisits,
            };
          }

          const requestedVisitIds = new Set(optimizerRequest.visits.map((visit) => visit.visitId));
          const matchedMeta = new Map<string, VisitInstanceMeta>();
          meta.forEach((value, key) => {
            if (requestedVisitIds.has(key)) {
              matchedMeta.set(key, value);
            }
          });
          if (matchedMeta.size > 0) {
            instanceMetaByVisitId = matchedMeta;
          }
        }
      } catch (error) {
        console.error("Failed to resolve visit instances for optimize-route v3 fallback.", error);
      }
    }

    const requestId = resolveRequestId(request);
    const result = await optimizeRouteV3(optimizerRequest, googleMapsApiKey, {
      requestId,
      nurseId: auth.nurseId,
      shadowCompare: shouldLogShadowComparison(requestId),
    });
    const parsedResponse = parseOptimizeRouteV2Response(result);
    if (!parsedResponse) {
      throw new HttpError(500, "Failed to shape optimize-route v3 response.");
    }

    try {
      await recordOptimizationRun({
        nurseId: auth.nurseId,
        endpointVersion: "v3",
        requestId,
        request: optimizerRequest,
        result,
        instanceMetaByVisitId,
      });
    } catch (error) {
      console.error("Failed to persist optimize-route v3 history.", error);
    }
    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "optimize.v3",
      resourceType: "route_optimization",
      outcome: "success",
      metadata: {
        planningDate: optimizerRequest.planningDate,
        visitCount: optimizerRequest.visits.length,
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
