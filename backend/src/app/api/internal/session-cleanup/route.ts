import { NextResponse } from "next/server";
import { cleanupAuthSessions } from "../../../../lib/auth/sessionRepository";
import { buildSecurityHeaders, HttpError, toErrorResponse } from "../../../../lib/http";

const DEFAULT_REVOKED_RETENTION_DAYS = 30;

const parsePositiveInteger = (rawValue: string | undefined, fallback: number) => {
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.floor(parsedValue);
};

const requireCleanupSecret = (request: Request) => {
  // Accept the dedicated secret OR Vercel's native CRON_SECRET. Vercel Cron only
  // attaches `Authorization: Bearer <CRON_SECRET>` to its invocations when a
  // CRON_SECRET env var is set, so without this the scheduled cron 401s and the
  // cleanup never runs.
  const configuredSecrets = [process.env.SESSION_CLEANUP_CRON_SECRET, process.env.CRON_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    throw new HttpError(503, "Session cleanup is not configured.");
  }

  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const fallbackHeader = request.headers.get("x-session-cleanup-key")?.trim();
  const providedSecret = bearerToken || fallbackHeader;

  const matchesConfiguredSecret = configuredSecrets.some((secret) => secret === providedSecret);
  if (!providedSecret || !matchesConfiguredSecret) {
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
