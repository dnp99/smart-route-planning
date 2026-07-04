import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNurseRouteRunsMock } = vi.hoisted(() => ({ fetchNurseRouteRunsMock: vi.fn() }));

vi.mock("../../features/admin/api/adminService", () => ({
  fetchNurseRouteRuns: fetchNurseRouteRunsMock,
}));

import NurseRouteRunsSection from "../../features/admin/ui/NurseRouteRunsSection";

const makeRun = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  planningDate: "2026-07-03",
  createdAt: "2026-07-03T14:00:00.000Z",
  requestedVisitCount: 5,
  scheduledVisitCount: 4,
  unscheduledVisitCount: 1,
  onTimeVisitCount: 3,
  totalDurationSeconds: 6465,
  totalDistanceMeters: 139063,
  optimizationObjective: "time",
  ...over,
});

describe("NurseRouteRunsSection", () => {
  beforeEach(() => fetchNurseRouteRunsMock.mockReset());
  afterEach(cleanup);

  it("renders route runs with stops, drive time, and mode", async () => {
    fetchNurseRouteRunsMock.mockResolvedValue({
      runs: [makeRun("run-1")],
      nextCursor: null,
      hasMore: false,
    });

    render(<NurseRouteRunsSection nurseId="nurse-1" />);

    await waitFor(() => expect(screen.getByText("Route runs")).toBeTruthy());
    // stops (scheduled), drive time (6465s -> 1h 48m), on-time, mode
    expect(await screen.findByText("1h 48m")).toBeTruthy();
    expect(screen.getByText("Finish sooner")).toBeTruthy();
    expect(screen.getByText("3/4")).toBeTruthy();
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("shows an empty state when there are no runs", async () => {
    fetchNurseRouteRunsMock.mockResolvedValue({ runs: [], nextCursor: null, hasMore: false });
    render(<NurseRouteRunsSection nurseId="nurse-1" />);
    expect(await screen.findByText("No route runs in the last 7 days.")).toBeTruthy();
  });

  it("loads more with the cursor and appends", async () => {
    fetchNurseRouteRunsMock
      .mockResolvedValueOnce({
        runs: [makeRun("run-1")],
        nextCursor: "2026-06-28T00:00:00.000Z",
        hasMore: true,
      })
      .mockResolvedValueOnce({ runs: [makeRun("run-2")], nextCursor: null, hasMore: false });

    render(<NurseRouteRunsSection nurseId="nurse-1" />);
    const loadMore = await screen.findByText("Load more");
    fireEvent.click(loadMore);

    await waitFor(() =>
      expect(fetchNurseRouteRunsMock).toHaveBeenCalledWith("nurse-1", "2026-06-28T00:00:00.000Z"),
    );
    await waitFor(() => expect(screen.queryByText("Load more")).toBeNull());
    // both pages' rows are present (two runs => two "1h 48m" drive-time cells)
    expect(screen.getAllByText("1h 48m").length).toBe(2);
  });
});
