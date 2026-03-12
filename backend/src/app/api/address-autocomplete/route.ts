import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { buildCorsHeaders, toErrorResponse } from "../../../lib/http";
import { getAddressAutocompleteResponse } from "./addressAutocompleteService";

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
    });

    await requireAuth(request);

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!googleMapsApiKey) {
      return NextResponse.json(
        { error: "Server is missing GOOGLE_MAPS_API_KEY configuration." },
        { status: 500, headers: corsHeaders },
      );
    }

    const response = await getAddressAutocompleteResponse(request, googleMapsApiKey);
    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch address suggestions.", corsHeaders);
  }
}
