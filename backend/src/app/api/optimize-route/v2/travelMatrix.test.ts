import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlanningTravelDurationMatrix } from "./travelMatrix";

describe("buildPlanningTravelDurationMatrix", () => {
  const fetchMock = vi.fn();

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
});
