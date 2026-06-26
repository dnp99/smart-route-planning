import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cleanupAuthSessionsMock } = vi.hoisted(() => ({
  cleanupAuthSessionsMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/sessionRepository", () => ({
  cleanupAuthSessions: cleanupAuthSessionsMock,
}));

import { GET, POST } from "./route";

describe("/api/internal/session-cleanup route", () => {
  const originalSecret = process.env.SESSION_CLEANUP_CRON_SECRET;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalRetentionDays = process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS;

  beforeEach(() => {
    process.env.SESSION_CLEANUP_CRON_SECRET = "cleanup-secret";
    delete process.env.CRON_SECRET;
    delete process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS;
    cleanupAuthSessionsMock.mockReset();
    cleanupAuthSessionsMock.mockResolvedValue({
      deletedCount: 7,
      now: new Date("2026-04-20T12:00:00.000Z"),
      revokedCutoff: new Date("2026-03-21T12:00:00.000Z"),
    });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_CLEANUP_CRON_SECRET;
    } else {
      process.env.SESSION_CLEANUP_CRON_SECRET = originalSecret;
    }

    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }

    if (originalRetentionDays === undefined) {
      delete process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS;
    } else {
      process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS = originalRetentionDays;
    }
  });

  it("rejects requests without secret", async () => {
    const response = await GET(new Request("http://localhost:3000/api/internal/session-cleanup"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("supports bearer authorization secret", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        headers: {
          authorization: "Bearer cleanup-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupAuthSessionsMock).toHaveBeenCalledWith({ revokedRetentionDays: 30 });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deletedCount: 7,
      revokedRetentionDays: 30,
      ranAt: "2026-04-20T12:00:00.000Z",
    });
  });

  it("supports x-session-cleanup-key secret", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        method: "POST",
        headers: {
          "x-session-cleanup-key": "cleanup-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupAuthSessionsMock).toHaveBeenCalledWith({ revokedRetentionDays: 30 });
  });

  it("accepts Vercel's native CRON_SECRET bearer token", async () => {
    // Vercel Cron injects `Authorization: Bearer <CRON_SECRET>` on scheduled runs.
    delete process.env.SESSION_CLEANUP_CRON_SECRET;
    process.env.CRON_SECRET = "vercel-cron-secret";

    const response = await GET(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        headers: {
          authorization: "Bearer vercel-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupAuthSessionsMock).toHaveBeenCalledWith({ revokedRetentionDays: 30 });
  });

  it("rejects a token that matches neither configured secret", async () => {
    process.env.CRON_SECRET = "vercel-cron-secret";

    const response = await GET(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("uses configured revoked-session retention days", async () => {
    process.env.SESSION_CLEANUP_REVOKED_RETENTION_DAYS = "14";

    const response = await GET(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        headers: {
          authorization: "Bearer cleanup-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupAuthSessionsMock).toHaveBeenCalledWith({ revokedRetentionDays: 14 });
  });

  it("returns 503 when cleanup secret is missing", async () => {
    delete process.env.SESSION_CLEANUP_CRON_SECRET;

    const response = await GET(
      new Request("http://localhost:3000/api/internal/session-cleanup", {
        headers: {
          authorization: "Bearer anything",
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Session cleanup is not configured." });
  });
});
