import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/requireAuth";
import { buildCorsHeaders } from "../../../lib/http";
import { enforceOptimizeRouteRateLimit, requireOptimizeRouteApiKey } from "./requestGuards";
import type { ValidatedOptimizeRouteV2Request } from "./v3/validation";

export const buildOptimizeRouteCorsHeaders = (request: Request) =>
  buildCorsHeaders(request, {
    methods: "POST, OPTIONS",
    allowedHeaders: "Content-Type, Authorization, x-optimize-route-key",
    originPolicy: "strict",
  });

export const toOptimizeRouteOptionsResponse = (request: Request) =>
  new NextResponse(null, {
    status: 204,
    headers: buildOptimizeRouteCorsHeaders(request),
  });

type ParseBody = (body: unknown) => ValidatedOptimizeRouteV2Request;

type PrepareOptimizeRouteRequestInput = {
  request: Request;
  corsHeaders: Record<string, string>;
  parseBody: ParseBody;
};

export type PreparedOptimizeRouteRequest = {
  auth: Awaited<ReturnType<typeof requireAuth>>;
  googleMapsApiKey: string;
  parsedRequest: ValidatedOptimizeRouteV2Request;
};

export const prepareOptimizeRouteRequest = async ({
  request,
  corsHeaders,
  parseBody,
}: PrepareOptimizeRouteRequestInput): Promise<PreparedOptimizeRouteRequest | NextResponse> => {
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

  const parsedRequest = parseBody(body);
  return {
    auth,
    googleMapsApiKey,
    parsedRequest,
  };
};
