import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistPlanningWindows,
  requestOptimizedRoute,
} from "../../components/routePlanner/routePlannerService";
import { setAuthSession } from "../../components/auth/authSession";

vi.mock("../../components/apiBaseUrl", () => ({
  resolveApiBaseUrl: () => "http://api.example.com",
}));

const buildValidResponse = () => ({
  start: {
    address: "Start",
    coords: { lat: 43.1, lon: -79.1 },
    departureTime: "2026-03-13T07:30:00-04:00",
  },
  end: {
    address: "End",
    coords: { lat: 43.2, lon: -79.2 },
  },
  orderedStops: [],
  routeLegs: [],
  unscheduledTasks: [],
  metrics: {
    fixedWindowViolations: 0,
    totalLateSeconds: 0,
    totalWaitSeconds: 0,
    totalDistanceMeters: 1000,
    totalDistanceKm: 1,
    totalDurationSeconds: 120,
  },
  algorithmVersion: "v2.1.0-greedy-window-first",
});

describe("requestOptimizedRoute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    setAuthSession("test-token", {
      id: "nurse-1",
      email: "nurse@example.com",
      displayName: "Nurse One",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("returns optimize-route v2 payload when response is valid", async () => {
    const payload = buildValidResponse();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await requestOptimizedRoute({
      startAddress: "Start",
      endAddress: "End",
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      departureTime: "2026-03-13T07:30:00-04:00",
      destinations: [
        {
          address: "A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          googlePlaceId: null,
          windowStart: "09:00",
          windowEnd: "09:30",
          windowType: "fixed",
        },
        {
          address: "B",
          patientId: "patient-2",
          patientName: "John Doe",
          googlePlaceId: "place-2",
          windowStart: "10:00",
          windowEnd: "11:00",
          windowType: "flexible",
        },
      ],
    });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.example.com/api/optimize-route/v2");
    expect(init.method).toBe("POST");

    expect(JSON.parse(String(init.body))).toEqual({
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      start: {
        address: "Start",
        departureTime: "2026-03-13T07:30:00-04:00",
      },
      end: {
        address: "End",
      },
      visits: [
        {
          visitId: "visit-1-patient-1",
          address: "A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          googlePlaceId: null,
          windowStart: "09:00",
          windowEnd: "09:30",
          windowType: "fixed",
          serviceDurationMinutes: 20,
        },
        {
          visitId: "visit-2-patient-2",
          address: "B",
          patientId: "patient-2",
          patientName: "John Doe",
          googlePlaceId: "place-2",
          windowStart: "10:00",
          windowEnd: "11:00",
          windowType: "flexible",
          serviceDurationMinutes: 20,
        },
      ],
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("includes manual start and end place ids when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => buildValidResponse(),
    } as Response);

    await requestOptimizedRoute({
      startAddress: "Start",
      startGooglePlaceId: "start-place",
      endAddress: "End",
      endGooglePlaceId: "end-place",
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      departureTime: "2026-03-13T07:30:00-04:00",
      destinations: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.example.com/api/optimize-route/v2");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      start: {
        address: "Start",
        googlePlaceId: "start-place",
        departureTime: "2026-03-13T07:30:00-04:00",
      },
      end: {
        address: "End",
        googlePlaceId: "end-place",
      },
      visits: [],
    });
  });

  it("omits departureTime when it is not provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T15:45:00.000Z"));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => buildValidResponse(),
    } as Response);

    await requestOptimizedRoute({
      startAddress: "Start",
      endAddress: "End",
      timezone: "America/Toronto",
      destinations: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));

    expect(body.planningDate).toBe("2026-03-13");
    expect(body.start).toEqual({
      address: "Start",
    });
  });

  it("throws API-provided error message on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Detailed backend error" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
      }),
    ).rejects.toThrow("Detailed backend error");
  });

  it("throws fallback error when non-ok response has no error string", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "not used" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
      }),
    ).rejects.toThrow("Unable to optimize route.");
  });

  it("throws when provided departureTime is invalid", async () => {
    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        departureTime: "not-a-date",
        destinations: [],
      }),
    ).rejects.toThrow("Invalid departure time.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when payload shape is unexpected on ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "invalid-shape" }),
    } as Response);

    await expect(
      requestOptimizedRoute({
        startAddress: "Start",
        endAddress: "End",
        destinations: [],
      }),
    ).rejects.toThrow("Unexpected API response format.");
  });

  it("enriches unscheduled tasks with visit details from request destinations", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...buildValidResponse(),
        unscheduledTasks: [
          {
            visitId: "visit-1-patient-1",
            patientId: "patient-1",
            reason: "fixed_window_unreachable",
          },
        ],
      }),
    } as Response);

    const result = await requestOptimizedRoute({
      startAddress: "Start",
      endAddress: "End",
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      departureTime: "2026-03-13T07:30:00-04:00",
      destinations: [
        {
          address: "A",
          patientId: "patient-1",
          patientName: "Jane Doe",
          windowStart: "08:30",
          windowEnd: "09:00",
          windowType: "fixed",
        },
      ],
    });

    expect(result.unscheduledTasks).toEqual([
      {
        visitId: "visit-1-patient-1",
        patientId: "patient-1",
        reason: "fixed_window_unreachable",
        patientName: "Jane Doe",
        address: "A",
        windowStart: "08:30",
        windowEnd: "09:00",
        windowType: "fixed",
      },
    ]);
  });

  it("keeps unscheduled task untouched when visitId is not found in request map", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...buildValidResponse(),
        unscheduledTasks: [
          {
            visitId: "unknown-visit",
            patientId: "patient-x",
            reason: "invalid_window",
          },
        ],
      }),
    } as Response);

    const result = await requestOptimizedRoute({
      startAddress: "Start",
      endAddress: "End",
      destinations: [],
    });

    expect(result.unscheduledTasks).toEqual([
      {
        visitId: "unknown-visit",
        patientId: "patient-x",
        reason: "invalid_window",
      },
    ]);
  });

  it("persists planning windows by merging overrides into existing patient windows", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patients: [
            {
              id: "patient-1",
              nurseId: "nurse-1",
              firstName: "Jane",
              lastName: "Doe",
              address: "123 Main St",
              googlePlaceId: null,
              visitDurationMinutes: 30,
              preferredVisitStartTime: "09:00",
              preferredVisitEndTime: "10:00",
              visitTimeType: "fixed",
              visitWindows: [
                {
                  id: "window-1a",
                  startTime: "09:00",
                  endTime: "10:00",
                  visitTimeType: "fixed",
                },
                {
                  id: "window-1b",
                  startTime: "15:00",
                  endTime: "16:00",
                  visitTimeType: "flexible",
                },
              ],
              createdAt: "2026-03-12T12:00:00.000Z",
              updatedAt: "2026-03-12T12:00:00.000Z",
            },
            {
              id: "patient-2",
              nurseId: "nurse-1",
              firstName: "John",
              lastName: "Doe",
              address: "456 Queen St",
              googlePlaceId: null,
              visitDurationMinutes: 45,
              preferredVisitStartTime: "09:00",
              preferredVisitEndTime: "10:00",
              visitTimeType: "fixed",
              visitWindows: [],
              createdAt: "2026-03-12T12:00:00.000Z",
              updatedAt: "2026-03-12T12:00:00.000Z",
            },
          ],
        }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

    await persistPlanningWindows([
      {
        patientId: "patient-1",
        sourceWindowId: "window-1a",
        startTime: "13:00",
        endTime: "14:00",
        visitTimeType: "flexible",
      },
      {
        patientId: "patient-1",
        sourceWindowId: null,
        startTime: "16:00",
        endTime: "17:00",
        visitTimeType: "fixed",
      },
      {
        patientId: "patient-2",
        sourceWindowId: null,
        startTime: "09:00",
        endTime: "10:00",
        visitTimeType: "fixed",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url,
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init.headers),
    }));

    expect(calls).toEqual([
      {
        url: "http://api.example.com/api/patients",
        method: "GET",
        body: null,
        headers: expect.any(Headers),
      },
      {
        url: "http://api.example.com/api/patients/patient-1",
        method: "PATCH",
        body: {
          visitWindows: [
            {
              startTime: "13:00",
              endTime: "14:00",
              visitTimeType: "flexible",
            },
            {
              startTime: "15:00",
              endTime: "16:00",
              visitTimeType: "flexible",
            },
            {
              startTime: "16:00",
              endTime: "17:00",
              visitTimeType: "fixed",
            },
          ],
        },
        headers: expect.any(Headers),
      },
      {
        url: "http://api.example.com/api/patients/patient-2",
        method: "PATCH",
        body: {
          visitWindows: [
            {
              startTime: "09:00",
              endTime: "10:00",
              visitTimeType: "fixed",
            },
          ],
        },
        headers: expect.any(Headers),
      },
    ]);

    calls.forEach((call) => {
      expect(call.headers.get("Authorization")).toBe("Bearer test-token");
    });

    expect(calls[0].headers.get("Content-Type")).toBeNull();
    expect(calls[1].headers.get("Content-Type")).toBe("application/json");
    expect(calls[2].headers.get("Content-Type")).toBe("application/json");
  });

  it("throws when patient to persist cannot be found in patient list", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        patients: [],
      }),
    } as Response);

    await expect(
      persistPlanningWindows([
        {
          patientId: "missing-patient",
          sourceWindowId: null,
          startTime: "09:00",
          endTime: "10:00",
          visitTimeType: "fixed",
        },
      ]),
    ).rejects.toThrow("Unable to save planning windows.");
  });

  it("returns early when there are no planning windows to persist", async () => {
    await persistPlanningWindows([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
