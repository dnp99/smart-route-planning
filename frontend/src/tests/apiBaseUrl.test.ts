import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiBaseUrl } from "../components/apiBaseUrl";

describe("resolveApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as Window & { __NAVIGATE_EASY_API_BASE_URL__?: string })
      .__NAVIGATE_EASY_API_BASE_URL__;
  });

  it("uses environment base URL when configured", () => {
    vi.stubEnv("VITE_API_BASE_URL", " https://api.example.com/ ");
    (
      window as Window & { __NAVIGATE_EASY_API_BASE_URL__?: string }
    ).__NAVIGATE_EASY_API_BASE_URL__ = "https://window.example.com";

    expect(resolveApiBaseUrl()).toBe("https://api.example.com");
  });

  it("uses window override when env is not set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    (
      window as Window & { __NAVIGATE_EASY_API_BASE_URL__?: string }
    ).__NAVIGATE_EASY_API_BASE_URL__ = " https://window.example.com/ ";

    expect(resolveApiBaseUrl()).toBe("https://window.example.com");
  });

  it("falls back to localhost default when env and window values are missing", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    delete (window as Window & { __NAVIGATE_EASY_API_BASE_URL__?: string })
      .__NAVIGATE_EASY_API_BASE_URL__;

    expect(resolveApiBaseUrl()).toBe("http://localhost:3000");
  });
});
