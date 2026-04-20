import { describe, expect, it } from "vitest";
import { resolveDeviceTypeFromUserAgent } from "./deviceType";

describe("resolveDeviceTypeFromUserAgent", () => {
  it("returns unknown for missing or blank values", () => {
    expect(resolveDeviceTypeFromUserAgent(undefined)).toBe("unknown");
    expect(resolveDeviceTypeFromUserAgent(null)).toBe("unknown");
    expect(resolveDeviceTypeFromUserAgent("   ")).toBe("unknown");
  });

  it("detects bots", () => {
    expect(resolveDeviceTypeFromUserAgent("curl/8.6.0")).toBe("bot");
    expect(resolveDeviceTypeFromUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(
      "bot",
    );
  });

  it("detects tablets", () => {
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("tablet");
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (Linux; Android 13; SM-X610) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
    ).toBe("tablet");
  });

  it("detects mobile devices", () => {
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("mobile");
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36",
      ),
    ).toBe("mobile");
  });

  it("detects desktop devices", () => {
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
      ),
    ).toBe("desktop");
    expect(
      resolveDeviceTypeFromUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
      ),
    ).toBe("desktop");
  });
});
