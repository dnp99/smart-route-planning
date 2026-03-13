import { NextResponse } from "next/server";
import { parseOptimizeRouteV2Response } from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
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
    await requireAuth(request);
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

    return NextResponse.json(parsedResponse, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to optimize route.", corsHeaders);
  }
}
