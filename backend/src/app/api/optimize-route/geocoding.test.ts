import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  geocodeAddressesSequentially,
  geocodeTargetsSequentially,
  normalizeAddressKey,
} from "./geocoding";

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

  it("uses Google place details when googlePlaceId is provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        location: {
          latitude: 43.7001,
          longitude: -79.4001,
        },
      }),
    } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "Address A", googlePlaceId: "place-123" }],
      "google-key",
    );

    expect(fetchMock).toHaveBeenCalledWith("https://places.googleapis.com/v1/places/place-123", {
      headers: {
        Accept: "application/json",
        "X-Goog-Api-Key": "google-key",
        "X-Goog-FieldMask": "location",
      },
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual([{ address: "Address A", coords: { lat: 43.7001, lon: -79.4001 } }]);
  });

  it("falls back to text geocoding when place lookup fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: "43.7000", lon: "-79.4000" }],
    } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "Address A", googlePlaceId: "place-123" }],
      "google-key",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ address: "Address A", coords: { lat: 43.7, lon: -79.4 } }]);
  });

  it("falls back to Google text search when plain text geocoding returns no results", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              location: {
                latitude: 43.5991,
                longitude: -79.6482,
              },
            },
          ],
        }),
      } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "6625 snow goose lane" }],
      "google-key",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "google-key",
          "X-Goog-FieldMask": "places.location",
        },
        body: JSON.stringify({
          textQuery: "6625 snow goose lane",
          regionCode: "CA",
        }),
        cache: "no-store",
        signal: expect.any(AbortSignal),
      },
    );
    expect(result).toEqual([
      { address: "6625 snow goose lane", coords: { lat: 43.5991, lon: -79.6482 } },
    ]);
  });

  it("rethrows plain geocoding failure when Google API key is unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await expect(
      geocodeTargetsSequentially([{ address: "Address A", googlePlaceId: "place-123" }], ""),
    ).rejects.toMatchObject({
      status: 400,
      message: "Could not geocode address: Address A",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps Google text search unauthorized response to API key error", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response);

    await expect(
      geocodeTargetsSequentially([{ address: "Address A" }], "google-key"),
    ).rejects.toMatchObject({
      status: 500,
      message: "Google Places API key is invalid or not authorized.",
    });
  });

  it("maps empty Google text search payloads to user-facing errors", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      } as Response);

    await expect(
      geocodeTargetsSequentially([{ address: "Address A" }], "google-key"),
    ).rejects.toMatchObject({
      status: 400,
      message: "Could not geocode address: Address A",
    });
  });

  it("maps Google text search network failures to unavailable errors", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockRejectedValueOnce(new Error("search unavailable"));

    await expect(
      geocodeTargetsSequentially([{ address: "Address A" }], "google-key"),
    ).rejects.toMatchObject({
      status: 503,
      message: "Place lookup service is currently unavailable.",
    });
  });

  it("maps Google text search 429 responses to rate-limit errors", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response);

    await expect(
      geocodeTargetsSequentially([{ address: "Address A" }], "google-key"),
    ).rejects.toMatchObject({
      status: 503,
      message: "Place lookup service is rate-limited. Please try again shortly.",
    });
  });

  it("maps unexpected Google text search errors", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await expect(
      geocodeTargetsSequentially([{ address: "Address A" }], "google-key"),
    ).rejects.toMatchObject({
      status: 503,
      message: "Place lookup service returned an unexpected error.",
    });
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

  it("falls back to text search when place details returns 429", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ location: { latitude: 43.6, longitude: -79.4 } }],
        }),
      } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "Address A", googlePlaceId: "place-429" }],
      "google-key",
    );

    expect(result).toEqual([{ address: "Address A", coords: { lat: 43.6, lon: -79.4 } }]);
  });

  it("falls back to text search when place details returns unexpected error", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ location: { latitude: 43.7, longitude: -79.5 } }],
        }),
      } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "Address B", googlePlaceId: "place-500" }],
      "google-key",
    );

    expect(result).toEqual([{ address: "Address B", coords: { lat: 43.7, lon: -79.5 } }]);
  });

  it("falls back to text search when place details response has no location field", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ location: { latitude: 43.8, longitude: -79.6 } }],
        }),
      } as Response);

    const result = await geocodeTargetsSequentially(
      [{ address: "Address C", googlePlaceId: "place-noloc" }],
      "google-key",
    );

    expect(result).toEqual([{ address: "Address C", coords: { lat: 43.8, lon: -79.6 } }]);
  });

  it("aborts timed-out Google text search requests", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockImplementationOnce((_, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      });

    const promise = geocodeTargetsSequentially([{ address: "Address D" }], "google-key");
    const assertion = expect(promise).rejects.toMatchObject({
      status: 503,
      message: "Place lookup service is currently unavailable.",
    });

    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });
});
