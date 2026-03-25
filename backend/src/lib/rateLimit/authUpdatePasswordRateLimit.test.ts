import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetUpdatePasswordRateLimitForTests,
  enforceUpdatePasswordRateLimit,
} from "./authUpdatePasswordRateLimit";

describe("authUpdatePasswordRateLimit", () => {
  beforeEach(() => {
    __resetUpdatePasswordRateLimitForTests();
  });

  afterEach(() => {
    __resetUpdatePasswordRateLimitForTests();
    vi.useRealTimers();
  });

  it("allows requests within the limit without throwing", () => {
    expect(() =>
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-1", clientKey: "10.0.0.1" }),
    ).not.toThrow();
  });

  it("applies lockout after exceeding max requests and includes retry-after header", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00.000Z"));

    // Exhaust the 5-request limit
    for (let i = 0; i < 5; i += 1) {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-2", clientKey: "10.0.0.2" });
    }

    expect(() =>
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-2", clientKey: "10.0.0.2" }),
    ).toThrow("Too many password update attempts. Please try again later.");
  });

  it("throws 429 with retry-after header on lockout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00.000Z"));

    for (let i = 0; i < 5; i += 1) {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-3", clientKey: "10.0.0.3" });
    }

    try {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-3", clientKey: "10.0.0.3" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toMatchObject({ status: 429, headers: { "Retry-After": "900" } });
    }
  });

  it("rejects subsequent requests during lockout period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00.000Z"));

    for (let i = 0; i < 5; i += 1) {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-4", clientKey: "10.0.0.4" });
    }
    // Trigger lockout
    try {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-4", clientKey: "10.0.0.4" });
    } catch {}

    // Advance a little — still within the 15-minute lockout
    vi.setSystemTime(new Date("2026-03-25T10:05:00.000Z"));
    expect(() =>
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-4", clientKey: "10.0.0.4" }),
    ).toThrow("Too many password update attempts. Please try again later.");
  });

  it("resets the window after the lockout expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00.000Z"));

    for (let i = 0; i < 5; i += 1) {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-5", clientKey: "10.0.0.5" });
    }
    // Trigger lockout
    try {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-5", clientKey: "10.0.0.5" });
    } catch {}

    // Advance past the 15-minute lockout window
    vi.setSystemTime(new Date("2026-03-25T10:16:00.000Z"));
    expect(() =>
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-5", clientKey: "10.0.0.5" }),
    ).not.toThrow();
  });

  it("enforces limit per nurseId bucket independently from clientKey bucket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00.000Z"));

    // Exhaust nurse bucket
    for (let i = 0; i < 5; i += 1) {
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-6", clientKey: `10.0.0.${i + 10}` });
    }

    // Same nurse, different client key — should now fail due to nurse bucket
    expect(() =>
      enforceUpdatePasswordRateLimit({ nurseId: "nurse-6", clientKey: "10.0.0.99" }),
    ).toThrow("Too many password update attempts. Please try again later.");
  });
});
