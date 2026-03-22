import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsTripUrl,
  formatDuration,
} from "../../components/routePlanner/routePlannerUtils";

describe("routePlannerUtils", () => {
  it("formats durations into minutes/hours text", () => {
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(3600)).toBe("1 hr");
    expect(formatDuration(3660)).toBe("1 hr 1 min");
  });

  it("builds Google Maps trip URL with origin, destination, and waypoints", () => {
    const result = {
      start: { address: "Start Address", coords: { lat: 43.1, lon: -79.1 } },
      end: { address: "End Address", coords: { lat: 43.3, lon: -79.3 } },
      orderedStops: [
        {
          address: "Stop A",
          coords: { lat: 43.2, lon: -79.2 },
          distanceFromPreviousKm: 5,
          durationFromPreviousSeconds: 500,
        },
        {
          address: "End Address",
          coords: { lat: 43.3, lon: -79.3 },
          distanceFromPreviousKm: 6,
          durationFromPreviousSeconds: 600,
          isEndingPoint: true,
        },
      ],
    };

    const url = new URL(buildGoogleMapsTripUrl(result));

    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(url.searchParams.get("origin")).toBe("Start Address");
    expect(url.searchParams.get("destination")).toBe("End Address");
    expect(url.searchParams.get("waypoints")).toBe("Stop A");
  });
});
