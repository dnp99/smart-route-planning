import { NextResponse } from "next/server";
import { buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { optimizeRoute } from "./optimizeRouteService";
import { parseAndValidateBody } from "./validation";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request, { methods: "POST, OPTIONS" }),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request, { methods: "POST, OPTIONS" });

  try {
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
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to optimize route.", corsHeaders);
  }
}
