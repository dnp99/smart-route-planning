import { NextResponse } from "next/server";
import { parseOptimizeRouteResponse } from "../../../../../shared/contracts";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { optimizeRoute } from "./optimizeRouteService";
import { enforceOptimizeRouteRateLimit, requireOptimizeRouteApiKey } from "./requestGuards";
import { parseAndValidateBody } from "./validation";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request, {
      methods: "POST, OPTIONS",
      allowedHeaders: "Content-Type, x-optimize-route-key",
    }),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request, {
    methods: "POST, OPTIONS",
    allowedHeaders: "Content-Type, x-optimize-route-key",
  });

  try {
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
    const result = await optimizeRoute(parsedRequest, googleMapsApiKey);
    const parsedResponse = parseOptimizeRouteResponse(result);
    if (!parsedResponse) {
      throw new HttpError(500, "Failed to shape optimize-route response.");
    }

    return NextResponse.json(parsedResponse, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to optimize route.", corsHeaders);
  }
}
