import { NextResponse } from "next/server";
import { parseOptimizeRouteV2Response } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../../lib/http";
import { enforceOptimizeRouteRateLimit, requireOptimizeRouteApiKey } from "../requestGuards";
import { optimizeRouteV3 } from "./optimizeRouteService";
import { parseAndValidateBody } from "../v2/validation";

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

const resolveRequestId = (request: Request) => request.headers.get("x-request-id")?.trim() || crypto.randomUUID();

const shouldLogShadowComparison = (requestId: string) => {
  if (!isEnabled(process.env.OPTIMIZE_ROUTE_V3_SHADOW_COMPARE)) {
    return false;
  }

  const sampleRate = parseShadowSampleRate(process.env.OPTIMIZE_ROUTE_V3_SHADOW_SAMPLE_RATE);
  return hashToUnitInterval(requestId) < sampleRate;
};

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
    const requestId = resolveRequestId(request);

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
    const result = await optimizeRouteV3(parsedRequest, googleMapsApiKey, {
      requestId,
      nurseId: auth.nurseId,
      shadowCompare: shouldLogShadowComparison(requestId),
    });
    const parsedResponse = parseOptimizeRouteV2Response(result);
    if (!parsedResponse) {
      throw new HttpError(500, "Failed to shape optimize-route v3 response.");
    }

    return NextResponse.json(parsedResponse, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to optimize route.", corsHeaders);
  }
}
