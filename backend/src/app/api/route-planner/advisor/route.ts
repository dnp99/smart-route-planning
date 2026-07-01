import { NextResponse } from "next/server";

import { requireAuth } from "../../../../lib/auth/requireAuth";
import { logAuditEvent } from "../../../../lib/audit/auditLogger";
import {
  resolveRequestIpAddress,
  resolveRequestUserAgent,
} from "../../../../lib/audit/requestAuditContext";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import { hasAnthropicKey } from "../../../../lib/ai/claude";
import { generateRouteAdvice } from "../../../../lib/ai/routeAdvisor";
import { enforceRouteAdvisorRateLimit } from "../../../../lib/rateLimit/routeAdvisorRateLimit";
import { isDeidentifiedRouteContext } from "../../../../../../shared/contracts";

export const runtime = "nodejs";

const CORS_OPTIONS = {
  methods: "POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization",
  originPolicy: "strict" as const,
};

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, CORS_OPTIONS);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to handle preflight request.");
  }
}

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  let actorNurseId: string | null = null;

  try {
    corsHeaders = buildCorsHeaders(request, CORS_OPTIONS);

    const auth = await requireAuth(request);
    actorNurseId = auth.nurseId;

    enforceRouteAdvisorRateLimit(auth.nurseId);

    // Benign when unconfigured: the frontend hides the panel on a 503.
    if (!hasAnthropicKey()) {
      return NextResponse.json(
        { error: "Route Advisor is not configured." },
        { status: 503, headers: corsHeaders },
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

    if (!isDeidentifiedRouteContext(body)) {
      throw new HttpError(400, "Invalid route context.");
    }

    const advice = await generateRouteAdvice(body);

    await logAuditEvent({
      actorNurseId: auth.nurseId,
      action: "route.advisor",
      resourceType: "route_optimization",
      outcome: "success",
      // Aggregates only — never the brief/suggestions text or any PHI.
      metadata: { stopCount: body.stopCount, warningCount: body.warnings.length },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return NextResponse.json(advice, { headers: corsHeaders });
  } catch (error) {
    await logAuditEvent({
      actorNurseId,
      action: "route.advisor",
      resourceType: "route_optimization",
      outcome: "error",
      metadata: { status: error instanceof HttpError ? error.status : 500 },
      ipAddress: resolveRequestIpAddress(request),
      userAgent: resolveRequestUserAgent(request),
    });

    return toErrorResponse(error, "Unable to get route advice.", corsHeaders);
  }
}
