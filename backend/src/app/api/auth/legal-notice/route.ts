import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import {
  CURRENT_LEGAL_NOTICE_VERSION,
  isLegalNoticeAcknowledgementRequired,
} from "../../../../lib/auth/legalNotice";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import {
  acknowledgeNurseLegalNotice,
  findNurseById,
} from "../../../../lib/patients/patientRepository";
import { requireSecureAuthTransport } from "../requestGuards";

const toPayload = (nurse: {
  legalNoticeAcceptedVersion?: string | null;
  legalNoticeAcceptedAt?: Date | null;
}) => {
  const acceptedVersion = nurse.legalNoticeAcceptedVersion ?? null;
  const required = isLegalNoticeAcknowledgementRequired(acceptedVersion);

  return {
    required,
    currentVersion: CURRENT_LEGAL_NOTICE_VERSION,
    acceptedVersion,
    acceptedAt: nurse.legalNoticeAcceptedAt ? nurse.legalNoticeAcceptedAt.toISOString() : null,
  };
};

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(toPayload(nurse), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to load legal notice status.", corsHeaders);
  }
}

export async function POST(request: Request) {
  let corsHeaders: Record<string, string> | undefined;
  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, POST, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
      allowCredentials: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON.");
    }

    if (typeof body !== "object" || body === null || (body as { agree?: unknown }).agree !== true) {
      throw new HttpError(400, "Payload must include agree=true.");
    }

    const updated = await acknowledgeNurseLegalNotice(auth.nurseId, CURRENT_LEGAL_NOTICE_VERSION);
    if (!updated || !updated.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(toPayload(updated), { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to acknowledge legal notice.", corsHeaders);
  }
}
