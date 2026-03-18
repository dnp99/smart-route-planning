import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlanningTravelDurationMatrix } from "./travelMatrix";

describe("buildPlanningTravelDurationMatrix", () => {
  const fetchMock = vi.fn();
  const buildMatrixResponse = (payloadText: string, ok = true, status = 200) =>
    ({
      ok,
      status,
      text: async () => payloadText,
    }) as Response;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns matrix durations from google response payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { originIndex: 0, destinationIndex: 1, duration: "120s" },
          { originIndex: 1, destinationIndex: 0, duration: "180s" },
        ]),
    } as Response);

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "start", coords: { lat: 43.6, lon: -79.6 } },
        { locationKey: "visit-a", coords: { lat: 43.7, lon: -79.7 } },
      ],
      "api-key",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(matrix.get("start")?.get("start")).toBe(0);
    expect(matrix.get("visit-a")?.get("visit-a")).toBe(0);
    expect(matrix.get("start")?.get("visit-a")).toBe(120);
    expect(matrix.get("visit-a")?.get("start")).toBe(180);
  });

  it("parses newline-delimited matrix element payloads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        '{"originIndex":0,"destinationIndex":1,"duration":"45s"}\n{"originIndex":1,"destinationIndex":0,"duration":"47s"}',
    } as Response);

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "left", coords: { lat: 43.61, lon: -79.61 } },
        { locationKey: "right", coords: { lat: 43.62, lon: -79.62 } },
      ],
      "api-key",
    );

    expect(matrix.get("left")?.get("right")).toBe(45);
    expect(matrix.get("right")?.get("left")).toBe(47);
  });

  it("keeps available durations and allows missing pairs for caller fallback", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ originIndex: 0, destinationIndex: 1, duration: "120s" }]),
    } as Response);

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
        { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
      ],
      "api-key",
    );

    expect(matrix.get("one")?.get("two")).toBe(120);
    expect(matrix.get("two")?.get("one")).toBeUndefined();
  });

  it("maps rate limit response to service unavailable", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Driving route matrix service is rate-limited. Please try again shortly.",
    });
  });

  it("returns self-distance matrix when there is only one node", async () => {
    const matrix = await buildPlanningTravelDurationMatrix(
      [{ locationKey: "only", coords: { lat: 43.6, lon: -79.6 } }],
      "api-key",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(matrix.get("only")?.get("only")).toBe(0);
  });

  it("maps google auth failures to internal configuration errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: "Google Routes API key is invalid or not authorized.",
    });
  });

  it("maps network failures to service unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Driving route matrix service is currently unavailable.",
    });
  });

  it("maps unexpected non-429 google failures to service unavailable", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Driving route matrix service returned an unexpected error.",
    });
  });

  it("parses object payloads with matrix arrays", async () => {
    fetchMock.mockResolvedValue(
      buildMatrixResponse(
        JSON.stringify({
          matrix: [{ originIndex: 0, destinationIndex: 1, duration: "90s" }],
        }),
      ),
    );

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "from", coords: { lat: 43.6, lon: -79.6 } },
        { locationKey: "to", coords: { lat: 43.7, lon: -79.7 } },
      ],
      "api-key",
    );

    expect(matrix.get("from")?.get("to")).toBe(90);
  });

  it("parses object payloads that contain a single matrix element", async () => {
    fetchMock.mockResolvedValue(
      buildMatrixResponse(
        JSON.stringify({ originIndex: 0, destinationIndex: 1, duration: "61s" }),
      ),
    );

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "from", coords: { lat: 43.6, lon: -79.6 } },
        { locationKey: "to", coords: { lat: 43.7, lon: -79.7 } },
      ],
      "api-key",
    );

    expect(matrix.get("from")?.get("to")).toBe(61);
  });

  it("throws when payload text is empty", async () => {
    fetchMock.mockResolvedValue(buildMatrixResponse("   "));

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Google Routes matrix returned an empty response.",
    });
  });

  it("throws when payload cannot be parsed into matrix elements", async () => {
    fetchMock.mockResolvedValue(buildMatrixResponse(JSON.stringify({ hello: "world" })));

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Google Routes matrix returned an invalid response payload.",
    });
  });

  it("throws when matrix returns out-of-range node indices", async () => {
    fetchMock.mockResolvedValue(
      buildMatrixResponse(
        JSON.stringify([{ originIndex: 0, destinationIndex: 9, duration: "61s" }]),
      ),
    );

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Google Routes matrix returned out-of-range indices.",
    });
  });

  it("ignores unavailable routes based on response condition and rpc status", async () => {
    fetchMock.mockResolvedValue(
      buildMatrixResponse(
        JSON.stringify([
          {
            originIndex: 0,
            destinationIndex: 1,
            duration: "120s",
            condition: "NO_ROUTE",
          },
          {
            originIndex: 1,
            destinationIndex: 0,
            duration: "140s",
            status: { code: 9 },
          },
        ]),
      ),
    );

    const matrix = await buildPlanningTravelDurationMatrix(
      [
        { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
        { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
      ],
      "api-key",
    );

    expect(matrix.get("one")?.get("two")).toBeUndefined();
    expect(matrix.get("two")?.get("one")).toBeUndefined();
  });

  it("throws when duration format is invalid", async () => {
    fetchMock.mockResolvedValue(
      buildMatrixResponse(
        JSON.stringify([{ originIndex: 0, destinationIndex: 1, duration: "invalid" }]),
      ),
    );

    await expect(
      buildPlanningTravelDurationMatrix(
        [
          { locationKey: "one", coords: { lat: 43.6, lon: -79.6 } },
          { locationKey: "two", coords: { lat: 43.7, lon: -79.7 } },
        ],
        "api-key",
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: "Google Routes matrix returned an invalid duration.",
    });
  });
});
