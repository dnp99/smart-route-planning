import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitRouteMapUnavailable,
  ROUTE_MAP_UNAVAILABLE_EVENT,
} from "../../components/routePlanner/routePlannerTelemetry";

const detail = {
  orderedStopCount: 2,
  routeLegCount: 1,
  hasStartCoords: true,
  hasStopCoords: false,
};

describe("emitRouteMapUnavailable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => emitRouteMapUnavailable(detail)).not.toThrow();
  });

  it("dispatches a custom event with the provided detail", () => {
    const dispatched: Event[] = [];
    const spy = vi.spyOn(window, "dispatchEvent").mockImplementation((e) => {
      dispatched.push(e);
      return true;
    });

    emitRouteMapUnavailable(detail);

    expect(spy).toHaveBeenCalledTimes(1);
    const event = dispatched[0] as CustomEvent;
    expect(event.type).toBe(ROUTE_MAP_UNAVAILABLE_EVENT);
    expect(event.detail).toEqual(detail);

    spy.mockRestore();
  });
});
