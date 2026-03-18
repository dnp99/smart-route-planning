import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteMap from "../../components/RouteMap";
import { ROUTE_MAP_UNAVAILABLE_EVENT } from "../../components/routePlanner/routePlannerTelemetry";

describe("RouteMap component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders fallback and emits telemetry when map geometry cannot be rendered", async () => {
    const telemetryHandler = vi.fn();
    const onTelemetryEvent = (event: Event) => telemetryHandler(event);
    window.addEventListener(ROUTE_MAP_UNAVAILABLE_EVENT, onTelemetryEvent);

    const routeMapProps = {
      start: {
        address: "Start",
        coords: { lat: Number.NaN, lon: Number.NaN },
        departureTime: "2026-03-13T07:30:00-04:00",
      },
      orderedStops: [],
      routeLegs: [],
    };

    const { rerender } = render(<RouteMap {...routeMapProps} />);
    expect(screen.getByText("Map unavailable for this route.")).toBeTruthy();

    rerender(<RouteMap {...routeMapProps} />);

    await waitFor(() => {
      expect(telemetryHandler).toHaveBeenCalledTimes(1);
    });

    const telemetryEvent = telemetryHandler.mock.calls[0]?.[0] as CustomEvent;
    expect(telemetryEvent.detail).toEqual({
      orderedStopCount: 0,
      routeLegCount: 0,
      hasStartCoords: false,
      hasStopCoords: false,
    });

    window.removeEventListener(ROUTE_MAP_UNAVAILABLE_EVENT, onTelemetryEvent);
  });
});
