import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddressesSequentially, normalizeAddressKey } from "./geocoding";

describe("geocoding helpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("normalizes address key to lowercase trimmed text", () => {
    expect(normalizeAddressKey("  A bC  ")).toBe("a bc");
  });

  it("geocodes addresses sequentially and returns coordinates", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "43.7000", lon: "-79.4000" }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "43.7100", lon: "-79.4100" }],
      } as Response);

    const promise = geocodeAddressesSequentially(["Address A", "Address B"]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { address: "Address A", coords: { lat: 43.7, lon: -79.4 } },
      { address: "Address B", coords: { lat: 43.71, lon: -79.41 } },
    ]);
  });

  it("maps network failures to unavailable geocoding error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(geocodeAddressesSequentially(["Address A"])).rejects.toMatchObject({
      status: 503,
      message: "Geocoding service is currently unavailable.",
    });
  });

  it("maps 429 geocoding responses to rate-limit error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(geocodeAddressesSequentially(["Address A"])).rejects.toMatchObject({
      status: 503,
      message: "Geocoding service is rate-limited. Please try again shortly.",
    });
  });

  it("maps unexpected non-ok geocoding responses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(geocodeAddressesSequentially(["Address A"])).rejects.toMatchObject({
      status: 503,
      message: "Geocoding service returned an unexpected error.",
    });
  });

  it("maps empty geocoding result sets to user-facing error", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] } as Response);

    await expect(geocodeAddressesSequentially(["Address A"])).rejects.toMatchObject({
      status: 400,
      message: "Could not geocode address: Address A",
    });
  });

  it("maps invalid coordinates returned by geocoder", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "NaN", lon: "-79.4" }],
    } as Response);

    await expect(geocodeAddressesSequentially(["Address A"])).rejects.toMatchObject({
      status: 503,
      message: "Geocoding service returned invalid coordinates.",
    });
  });

  it("aborts timed-out geocoding requests", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });

    const promise = geocodeAddressesSequentially(["Address A"]);
    const assertion = expect(promise).rejects.toMatchObject({
      status: 503,
      message: "Geocoding service is currently unavailable.",
    });

    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });
});
