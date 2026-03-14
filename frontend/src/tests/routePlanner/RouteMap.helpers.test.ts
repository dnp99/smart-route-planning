import { describe, expect, it } from "vitest";
import type { OrderedStop } from "../../components/types";
import {
  buildStopMarkerText,
  computeMarkerIconMetrics,
  offsetOverlappingMarkers,
  toPatientInitials,
  type RoutePoint,
} from "../../components/RouteMap";

const createTask = (patientName: string) =>
  ({ patientName } as OrderedStop["tasks"][number]);

const createRoutePoint = (
  overrides: Partial<RoutePoint>,
): RoutePoint => ({
  label: "Stop 1",
  address: "123 Main St",
  lat: 43.58025,
  lon: -79.77682,
  markerLat: 43.58025,
  markerLon: -79.77682,
  markerText: "YR",
  markerVariant: "stop",
  ...overrides,
});

describe("RouteMap helpers", () => {
  it("builds patient initials from first and last name", () => {
    expect(toPatientInitials("Yasmin Ramji")).toBe("YR");
    expect(toPatientInitials("Jeseph D'souza")).toBe("JD");
    expect(toPatientInitials("Prince")).toBe("PR");
  });

  it("aggregates stop marker text per task initials", () => {
    expect(
      buildStopMarkerText([
        createTask("Yasmin Ramji"),
        createTask("Yasmin Ramji"),
      ]),
    ).toBe("YR+YR");

    expect(
      buildStopMarkerText([
        createTask("Yasmin Ramji"),
        createTask("Xavier Ross"),
      ]),
    ).toBe("YR+XR");

    expect(
      buildStopMarkerText([
        createTask("Yasmin Ramji"),
        createTask("Xavier Ross"),
        createTask("Ann Lee"),
      ]),
    ).toBe("YR+XR+1");
  });

  it("computes marker icon size and centered anchor from text length", () => {
    const shortTextMetrics = computeMarkerIconMetrics("YR");
    expect(shortTextMetrics.width).toBe(32);
    expect(shortTextMetrics.anchorX).toBe(16);

    const longerTextMetrics = computeMarkerIconMetrics("YR+XR+AB");
    expect(longerTextMetrics.width).toBeGreaterThan(32);
    expect(longerTextMetrics.width).toBeLessThanOrEqual(84);
    expect(longerTextMetrics.anchorX).toBe(Math.round(longerTextMetrics.width / 2));
  });

  it("offsets markers that overlap or are very close", () => {
    const points = [
      createRoutePoint({ markerText: "YR" }),
      createRoutePoint({ markerText: "XR" }),
      createRoutePoint({
        markerText: "AL",
        lat: 43.58031,
        lon: -79.77682,
        markerLat: 43.58031,
        markerLon: -79.77682,
      }),
      createRoutePoint({
        markerText: "E",
        lat: 43.59025,
        lon: -79.77682,
        markerLat: 43.59025,
        markerLon: -79.77682,
      }),
    ];

    const offsetPoints = offsetOverlappingMarkers(points);
    const overlappingPositions = offsetPoints.slice(0, 3).map((point) => {
      return `${point.markerLat.toFixed(6)},${point.markerLon.toFixed(6)}`;
    });

    expect(new Set(overlappingPositions).size).toBe(3);
    expect(offsetPoints[3].markerLat).toBeCloseTo(points[3].lat, 6);
    expect(offsetPoints[3].markerLon).toBeCloseTo(points[3].lon, 6);
  });
});
