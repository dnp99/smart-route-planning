import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptimizedStopList } from "../../components/routePlanner/OptimizedStopList";
import type { OrderedStop } from "../../components/types";

const buildTask = (overrides: Partial<OrderedStop["tasks"][number]> = {}): OrderedStop["tasks"][number] => ({
  visitId: "visit-1",
  patientId: "patient-1",
  patientName: "alex johnson",
  address: "10 First Avenue",
  serviceStartTime: "2026-03-20T10:00:00-04:00",
  serviceEndTime: "2026-03-20T10:30:00-04:00",
  serviceDurationMinutes: 30,
  windowStart: "09:00",
  windowEnd: "10:30",
  windowType: "fixed",
  lateBySeconds: 0,
  onTime: true,
  ...overrides,
});

const buildStop = (overrides: Partial<OrderedStop> = {}): OrderedStop => ({
  stopId: "stop-1",
  address: "10 First Avenue",
  lat: 43.7,
  lng: -79.4,
  distanceFromPreviousKm: 5,
  durationFromPreviousSeconds: 900,
  arrivalTime: "2026-03-20T09:45:00-04:00",
  departureTime: "2026-03-20T10:30:00-04:00",
  isEndingPoint: false,
  tasks: [buildTask()],
  ...overrides,
});

describe("OptimizedStopList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders break cards, empty stops, and a home ending point", () => {
    const onToggleTask = vi.fn();
    const onToggleEnding = vi.fn();

    const stops: OrderedStop[] = [
      buildStop({
        stopId: "stop-1",
        departureTime: "2026-03-20T09:00:00-04:00",
      }),
      buildStop({
        stopId: "stop-2",
        address: "20 Second Avenue",
        arrivalTime: "2026-03-20T11:15:00-04:00",
        departureTime: "2026-03-20T11:45:00-04:00",
        durationFromPreviousSeconds: 900,
        tasks: [buildTask({ visitId: "visit-2", patientName: "jamie doe", address: "20 Second Avenue", serviceStartTime: "2026-03-20T11:30:00-04:00", serviceEndTime: "2026-03-20T12:00:00-04:00" })],
      }),
      buildStop({
        stopId: "stop-3",
        address: "30 Third Avenue",
        tasks: [],
        durationFromPreviousSeconds: 600,
      }),
      buildStop({
        stopId: "stop-4",
        address: " 99 Home Road ",
        tasks: [],
        isEndingPoint: true,
        arrivalTime: "2026-03-20T13:15:00-04:00",
        departureTime: "2026-03-20T13:15:00-04:00",
      }),
    ];

    render(
      <OptimizedStopList
        orderedStops={stops}
        expandedResultTaskIds={{ "visit-1": true }}
        onToggleResultTask={onToggleTask}
        expandedResultEndingStopIds={{ "ending:stop-4": true }}
        onToggleResultEndingStop={onToggleEnding}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.getByText(/Break · 2h 15m/)).toBeTruthy();
    expect(screen.getByText("No scheduled visit tasks at this stop.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle details for Alex Johnson" })).toBeTruthy();
    expect(screen.getByTestId("details-chevron-visit-1").getAttribute("data-expanded")).toBe(
      "true",
    );
    expect(screen.getByText("Duration: 30 min")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle details for Home ending point" })).toBeTruthy();
    expect(screen.getByText(/You should be home by/i)).toBeTruthy();
    expect(screen.getByText("Address: 99 Home Road")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toggle details for Alex Johnson" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle details for Home ending point" }));

    expect(onToggleTask).toHaveBeenCalledWith("visit-1");
    expect(onToggleEnding).toHaveBeenCalledWith("ending:stop-4");
  });

  it("renders non-home ending points and omits break cards before ending-point stops", () => {
    const stops: OrderedStop[] = [
      buildStop({
        stopId: "stop-a",
        departureTime: "2026-03-20T09:00:00-04:00",
      }),
      buildStop({
        stopId: "stop-b",
        address: "Clinic Exit",
        tasks: [],
        isEndingPoint: true,
        durationFromPreviousSeconds: 900,
        arrivalTime: "2026-03-20T09:45:00-04:00",
        departureTime: "2026-03-20T09:45:00-04:00",
      }),
    ];

    render(
      <OptimizedStopList
        orderedStops={stops}
        expandedResultTaskIds={{}}
        onToggleResultTask={() => undefined}
        expandedResultEndingStopIds={{}}
        onToggleResultEndingStop={() => undefined}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.queryByText(/Break ·/)).toBeNull();
    expect(screen.getByTestId("details-chevron-visit-1").getAttribute("data-expanded")).toBe(
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Toggle details for Ending point" }).textContent,
    ).toContain("Clinic Exit");
    expect(screen.queryByText(/You should be home by/i)).toBeNull();
  });

  it("omits break card when idle gap is below threshold on a regular patient stop", () => {
    // gap = serviceStartTime(09:44) - departureTime(09:00) - travel(15min) = 29 min — below threshold
    const stops: OrderedStop[] = [
      buildStop({
        stopId: "stop-below-a",
        departureTime: "2026-03-20T09:00:00-04:00",
      }),
      buildStop({
        stopId: "stop-below-b",
        address: "50 Fifth Avenue",
        arrivalTime: "2026-03-20T09:44:00-04:00",
        departureTime: "2026-03-20T10:14:00-04:00",
        durationFromPreviousSeconds: 900,
        tasks: [
          buildTask({
            visitId: "visit-below",
            patientName: "river stone",
            address: "50 Fifth Avenue",
            serviceStartTime: "2026-03-20T09:44:00-04:00",
            serviceEndTime: "2026-03-20T10:14:00-04:00",
          }),
        ],
      }),
    ];

    render(
      <OptimizedStopList
        orderedStops={stops}
        expandedResultTaskIds={{}}
        onToggleResultTask={() => undefined}
        expandedResultEndingStopIds={{}}
        onToggleResultEndingStop={() => undefined}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.queryByText(/Break ·/)).toBeNull();
  });

  it("renders a break card when idle gap is exactly 30 minutes", () => {
    const stops: OrderedStop[] = [
      buildStop({
        stopId: "stop-early",
        departureTime: "2026-03-20T09:00:00-04:00",
      }),
      buildStop({
        stopId: "stop-threshold",
        address: "40 Fourth Avenue",
        arrivalTime: "2026-03-20T09:45:00-04:00",
        departureTime: "2026-03-20T10:15:00-04:00",
        durationFromPreviousSeconds: 900,
        tasks: [
          buildTask({
            visitId: "visit-threshold",
            patientName: "morgan lane",
            address: "40 Fourth Avenue",
            serviceStartTime: "2026-03-20T09:45:00-04:00",
            serviceEndTime: "2026-03-20T10:15:00-04:00",
          }),
        ],
      }),
    ];

    render(
      <OptimizedStopList
        orderedStops={stops}
        expandedResultTaskIds={{}}
        onToggleResultTask={() => undefined}
        expandedResultEndingStopIds={{}}
        onToggleResultEndingStop={() => undefined}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.getByText(/Break · 30m/)).toBeTruthy();
  });
});
