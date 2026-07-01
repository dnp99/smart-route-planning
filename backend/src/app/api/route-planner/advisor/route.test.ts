import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../lib/http";
import type { DeidentifiedRouteContext } from "../../../../../../shared/contracts";

const {
  requireAuthMock,
  hasAnthropicKeyMock,
  generateRouteAdviceMock,
  enforceRateLimitMock,
  logAuditEventMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  hasAnthropicKeyMock: vi.fn(),
  generateRouteAdviceMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  logAuditEventMock: vi.fn(),
}));

vi.mock("../../../../lib/auth/requireAuth", () => ({
  requireAuth: requireAuthMock,
}));
vi.mock("../../../../lib/ai/claude", () => ({
  hasAnthropicKey: hasAnthropicKeyMock,
}));
vi.mock("../../../../lib/ai/routeAdvisor", () => ({
  generateRouteAdvice: generateRouteAdviceMock,
}));
vi.mock("../../../../lib/rateLimit/routeAdvisorRateLimit", () => ({
  enforceRouteAdvisorRateLimit: enforceRateLimitMock,
}));
vi.mock("../../../../lib/audit/auditLogger", () => ({
  logAuditEvent: logAuditEventMock,
}));

import { OPTIONS, POST } from "./route";

const validContext: DeidentifiedRouteContext = {
  planningWeekday: "Wednesday",
  timezone: "America/New_York",
  stopCount: 4,
  visitCount: 4,
  finishTime: "02:11 PM",
  leaveByTime: "07:45 AM",
  metrics: {
    distanceKm: 42.5,
    durationMinutes: 380,
    lateMinutes: 12,
    waitMinutes: 0,
    fixedWindowViolations: 1,
  },
  warnings: [{ type: "fixed_late", lateMinutes: 12 }],
  unscheduledByReason: {},
  stops: [
    { index: 1, windowType: "fixed", onTime: true },
    { index: 2, windowType: "flexible", onTime: false, lateMinutes: 12 },
  ],
};

const postRequest = (body?: unknown) =>
  new Request("http://localhost:3000/api/route-planner/advisor", {
    method: "POST",
    headers: { origin: "http://localhost:5173", "content-type": "application/json" },
    body: body === undefined ? "not-json{" : JSON.stringify(body),
  });

describe("/api/route-planner/advisor route", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ nurseId: "nurse-1", email: "nurse@example.com" });
    hasAnthropicKeyMock.mockReset();
    hasAnthropicKeyMock.mockReturnValue(true);
    generateRouteAdviceMock.mockReset();
    generateRouteAdviceMock.mockResolvedValue({
      brief: "Your day wraps by 2:11 PM.",
      suggestions: ["Stop 2 runs 12 minutes late — confirm the client can flex."],
    });
    enforceRateLimitMock.mockReset();
    enforceRateLimitMock.mockImplementation(() => undefined);
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("handles OPTIONS preflight", async () => {
    const response = await OPTIONS(
      new Request("http://localhost:3000/api/route-planner/advisor", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns 401 when authorization is missing or invalid", async () => {
    requireAuthMock.mockRejectedValue(new HttpError(401, "Unauthorized."));

    const response = await POST(postRequest(validContext));

    expect(response.status).toBe(401);
    expect(generateRouteAdviceMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-nurse rate limit is exceeded", async () => {
    enforceRateLimitMock.mockImplementation(() => {
      throw new HttpError(429, "Too many advice requests. Please wait a moment.", {
        headers: { "Retry-After": "30" },
      });
    });

    const response = await POST(postRequest(validContext));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(generateRouteAdviceMock).not.toHaveBeenCalled();
  });

  it("returns 503 when no API key is configured", async () => {
    hasAnthropicKeyMock.mockReturnValue(false);

    const response = await POST(postRequest(validContext));

    expect(response.status).toBe(503);
    expect(generateRouteAdviceMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const response = await POST(postRequest(undefined));

    expect(response.status).toBe(400);
    expect(generateRouteAdviceMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the context shape is invalid", async () => {
    const response = await POST(postRequest({ planningWeekday: "Wednesday" }));

    expect(response.status).toBe(400);
    expect(generateRouteAdviceMock).not.toHaveBeenCalled();
  });

  it("returns 200 with brief and suggestions for a valid context", async () => {
    const response = await POST(postRequest(validContext));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.brief).toBe("Your day wraps by 2:11 PM.");
    expect(payload.suggestions).toHaveLength(1);
    expect(generateRouteAdviceMock).toHaveBeenCalledWith(expect.objectContaining({ stopCount: 4 }));
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "route.advisor", outcome: "success" }),
    );
  });
});
