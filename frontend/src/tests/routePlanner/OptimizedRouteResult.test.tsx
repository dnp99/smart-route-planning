import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptimizedRouteResult } from "../../components/routePlanner/OptimizedRouteResult";
import type { OptimizeRouteResponse } from "../../components/types";

vi.mock("../../components/RouteMap", () => ({
  default: () => <div>Route Map Mock</div>,
}));

const buildResult = (overrides: Partial<OptimizeRouteResponse> = {}): OptimizeRouteResponse => ({
  start: {
    address: "Start Address",
    coords: { lat: 43.7, lon: -79.4 },
    departureTime: "2026-03-20T08:30:00-04:00",
  },
  end: {
    address: "99 Home Road",
    coords: { lat: 43.72, lon: -79.42 },
  },
  orderedStops: [
    {
      stopId: "stop-1",
      address: "10 First Avenue",
      lat: 43.71,
      lng: -79.41,
      distanceFromPreviousKm: 5,
      durationFromPreviousSeconds: 1200,
      arrivalTime: "2026-03-20T08:50:00-04:00",
      departureTime: "2026-03-20T09:30:00-04:00",
      isEndingPoint: false,
      tasks: [
        {
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "alex johnson",
          address: "10 First Avenue",
          serviceStartTime: "2026-03-20T09:00:00-04:00",
          serviceEndTime: "2026-03-20T09:30:00-04:00",
          serviceDurationMinutes: 30,
          windowStart: "09:00",
          windowEnd: "10:00",
          windowType: "fixed",
          lateBySeconds: 0,
          onTime: true,
        },
      ],
    },
    {
      stopId: "stop-end",
      address: "99 Home Road",
      lat: 43.72,
      lng: -79.42,
      distanceFromPreviousKm: 3,
      durationFromPreviousSeconds: 900,
      arrivalTime: "2026-03-20T09:45:00-04:00",
      departureTime: "2026-03-20T09:45:00-04:00",
      isEndingPoint: true,
      tasks: [],
    },
  ],
  routeLegs: [
    {
      fromStopId: "start",
      toStopId: "stop-1",
      distanceKm: 5,
      durationSeconds: 1200,
      polyline: "encoded",
    },
  ],
  metrics: {
    totalDistanceKm: 8,
    totalDurationSeconds: 2100,
  },
  warnings: [],
  unscheduledTasks: [],
  ...overrides,
});

describe("OptimizedRouteResult", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders warnings, stop list, and unscheduled task details while leave-by is hidden", () => {
    const onDismissConflictWarnings = vi.fn();
    const onDismissLatenessWarnings = vi.fn();

    render(
      <OptimizedRouteResult
        result={buildResult({
          warnings: [
            {
              type: "window_conflict",
              patientIds: ["patient-1", "patient-2"],
              message: "Two fixed windows overlap.",
            },
            {
              type: "late_arrival",
              patientId: "patient-3",
              message: "Arrival is after preferred window.",
            },
            {
              type: "late_arrival",
              patientId: "patient-4",
              message: "Second patient is also late.",
            },
          ],
          unscheduledTasks: [
            {
              visitId: "visit-x",
              patientId: "patient-x",
              patientName: "jamie doe",
              address: "55 Sunset Blvd",
              windowStart: "14:00",
              windowEnd: "15:00",
              windowType: "flexible",
              reason: "duration_exceeds_window",
            },
          ],
        })}
        conflictWarningsDismissed={false}
        onDismissConflictWarnings={onDismissConflictWarnings}
        latenessWarningsDismissed={false}
        onDismissLatenessWarnings={onDismissLatenessWarnings}
        expandedResultTaskIds={{}}
        onToggleResultTask={() => undefined}
        expandedResultEndingStopIds={{}}
        onToggleResultEndingStop={() => undefined}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.getByRole("heading", { name: "Optimized Route" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toBeTruthy();
    expect(screen.queryByText(/Suggested leave-by:/)).toBeNull();
    expect(screen.getByText("Scheduling Conflict")).toBeTruthy();
    expect(screen.getByText("Lateness Warnings")).toBeTruthy();
    expect(screen.getByText("Two fixed windows overlap.")).toBeTruthy();
    expect(screen.getByText("Route Map Mock")).toBeTruthy();
    expect(screen.getByText("Unscheduled Visits (1)")).toBeTruthy();
    expect(screen.getByText("Jamie Doe")).toBeTruthy();
    expect(screen.getByText("55 Sunset Blvd")).toBeTruthy();
    expect(screen.getByText("14:00 - 15:00 • flexible")).toBeTruthy();
    expect(screen.getByText("Reason: Service duration is longer than the window.")).toBeTruthy();

    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss warning" });
    fireEvent.click(dismissButtons[0]);
    fireEvent.click(dismissButtons[1]);

    expect(onDismissConflictWarnings).toHaveBeenCalledTimes(1);
    expect(onDismissLatenessWarnings).toHaveBeenCalledTimes(1);
  });

  it("omits optional sections when warnings, intermediate stops, and unscheduled details are absent", () => {
    render(
      <OptimizedRouteResult
        result={buildResult({
          orderedStops: [
            {
              stopId: "stop-end-only",
              address: "Clinic Exit",
              lat: 43.72,
              lng: -79.42,
              distanceFromPreviousKm: 3,
              durationFromPreviousSeconds: 900,
              arrivalTime: "invalid-date",
              departureTime: "invalid-date",
              isEndingPoint: true,
              tasks: [],
            },
          ],
          routeLegs: [],
          warnings: [],
          unscheduledTasks: [
            {
              visitId: "visit-fallback",
              patientId: "patient-fallback",
              reason: "invalid_window",
            },
          ],
        })}
        conflictWarningsDismissed={true}
        onDismissConflictWarnings={() => undefined}
        latenessWarningsDismissed={true}
        onDismissLatenessWarnings={() => undefined}
        expandedResultTaskIds={{}}
        onToggleResultTask={() => undefined}
        expandedResultEndingStopIds={{}}
        onToggleResultEndingStop={() => undefined}
        normalizedHomeAddress="99 home road"
      />,
    );

    expect(screen.queryByText(/Suggested leave-by:/)).toBeNull();
    expect(screen.queryByText(/Scheduling Conflict/)).toBeNull();
    expect(screen.queryByText(/Lateness Warning/)).toBeNull();
    expect(screen.queryAllByRole("list").length).toBeGreaterThan(0);
    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("patient-fallback")).toBeTruthy();
    expect(screen.queryByText(/ • /)).toBeNull();
    expect(screen.getByText("Reason: The visit window is invalid.")).toBeTruthy();
  });
});
