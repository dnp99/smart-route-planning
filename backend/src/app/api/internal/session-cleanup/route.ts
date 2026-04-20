import { NextResponse } from "next/server";
import { cleanupAuthSessions } from "../../../../lib/auth/sessionRepository";
import { buildSecurityHeaders, HttpError, toErrorResponse } from "../../../../lib/http";

const DEFAULT_REVOKED_RETENTION_DAYS = 30;

const parsePositiveInteger = (rawValue: string | undefined, fallback: number) => {
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.floor(parsedValue);
};

const requireCleanupSecret = (request: Request) => {
  const expectedSecret = process.env.SESSION_CLEANUP_CRON_SECRET?.trim();
  if (!expectedSecret) {
    throw new HttpError(503, "Session cleanup is not configured.");
  }

  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const fallbackHeader = request.headers.get("x-session-cleanup-key")?.trim();
  const providedSecret = bearerToken || fallbackHeader;

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new HttpError(401, "Unauthorized.");
  }
};

const handleCleanup = async (request: Request) => {
  try {
    requireCleanupSecret(request);

    const revokedRetentionDays = parsePositiveInteger(
      process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS,
      DEFAULT_REVOKED_RETENTION_DAYS,
    );
    const result = await cleanupAuthSessions({
      revokedRetentionDays,
    });

    return NextResponse.json(
      {
        ok: true,
        deletedCount: result.deletedCount,
        revokedRetentionDays,
        ranAt: result.now.toISOString(),
      },
      {
        headers: buildSecurityHeaders(request),
      },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to clean up sessions.", buildSecurityHeaders(request));
  }
};

export const GET = handleCleanup;
export const POST = handleCleanup;
