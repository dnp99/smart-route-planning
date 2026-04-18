import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportRouteImage } from "../../features/route-planner/utils/routeImageExport";
import type { OptimizeRouteResponse } from "../../components/types";

const buildResult = (overrides: Partial<OptimizeRouteResponse> = {}): OptimizeRouteResponse => ({
  start: {
    address: "Start Address",
    coords: { lat: 43.7, lon: -79.4 },
    departureTime: "2026-03-26T08:00:00-04:00",
  },
  end: {
    address: "99 Home Road",
    coords: { lat: 43.72, lon: -79.42 },
  },
  orderedStops: [
    {
      stopId: "stop-1",
      address: "10 First Avenue",
      coords: { lat: 43.71, lon: -79.41 },
      distanceFromPreviousKm: 5,
      durationFromPreviousSeconds: 1200,
      arrivalTime: "2026-03-26T08:20:00-04:00",
      departureTime: "2026-03-26T09:00:00-04:00",
      isEndingPoint: false,
      tasks: [
        {
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "alex johnson",
          address: "10 First Avenue",
          arrivalTime: "2026-03-26T08:20:00-04:00",
          serviceStartTime: "2026-03-26T08:30:00-04:00",
          serviceEndTime: "2026-03-26T09:00:00-04:00",
          serviceDurationMinutes: 30,
          windowStart: "08:30",
          windowEnd: "09:30",
          windowType: "fixed",
          waitSeconds: 600,
          lateBySeconds: 0,
          onTime: true,
        },
      ],
    },
    {
      stopId: "stop-2",
      address: "20 Second Street",
      coords: { lat: 43.73, lon: -79.43 },
      distanceFromPreviousKm: 3,
      durationFromPreviousSeconds: 900,
      arrivalTime: "2026-03-26T11:45:00-04:00",
      departureTime: "2026-03-26T12:15:00-04:00",
      isEndingPoint: false,
      tasks: [
        {
          visitId: "visit-2",
          patientId: "patient-2",
          patientName: "jamie doe",
          address: "20 Second Street",
          arrivalTime: "2026-03-26T11:45:00-04:00",
          serviceStartTime: "2026-03-26T12:00:00-04:00",
          serviceEndTime: "2026-03-26T12:15:00-04:00",
          serviceDurationMinutes: 15,
          windowStart: "11:30",
          windowEnd: "13:00",
          windowType: "flexible",
          waitSeconds: 900,
          lateBySeconds: 300,
          onTime: false,
        },
      ],
    },
    {
      stopId: "stop-end",
      address: "99 Home Road",
      coords: { lat: 43.72, lon: -79.42 },
      distanceFromPreviousKm: 3,
      durationFromPreviousSeconds: 900,
      arrivalTime: "2026-03-26T12:30:00-04:00",
      departureTime: "2026-03-26T12:30:00-04:00",
      isEndingPoint: true,
      tasks: [],
    },
  ],
  routeLegs: [
    {
      fromStopId: "start",
      toStopId: "stop-1",
      fromAddress: "Start Address",
      toAddress: "10 First Avenue",
      distanceMeters: 5000,
      durationSeconds: 1200,
      encodedPolyline: "encoded-1",
    },
    {
      fromStopId: "stop-1",
      toStopId: "stop-2",
      fromAddress: "10 First Avenue",
      toAddress: "20 Second Street",
      distanceMeters: 3000,
      durationSeconds: 900,
      encodedPolyline: "encoded-2",
    },
  ],
  metrics: {
    fixedWindowViolations: 1,
    totalLateSeconds: 300,
    totalWaitSeconds: 1500,
    totalDistanceMeters: 11000,
    totalDistanceKm: 11,
    totalDurationSeconds: 3000,
  },
  algorithmVersion: "v3.test",
  warnings: [],
  unscheduledTasks: [
    {
      visitId: "visit-x",
      patientId: "patient-x",
      patientName: "taylor smith",
      address: "55 Sunset Blvd",
      windowStart: "14:00",
      windowEnd: "15:00",
      windowType: "flexible",
      reason: "invalid_window",
    },
  ],
  ...overrides,
});

type MockCanvasContext = {
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
  lineWidth: number;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
};

const createMockContext = (): MockCanvasContext => ({
  fillStyle: "",
  strokeStyle: "",
  font: "",
  textBaseline: "alphabetic",
  textAlign: "left",
  lineWidth: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fillRect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
  arc: vi.fn(),
});

describe("routeImageExport", () => {
  const originalCreateElement = document.createElement.bind(document);
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCanShare = navigator.canShare;
  const originalShare = navigator.share;

  let mockContext: MockCanvasContext;
  let toBlobImpl: (callback: BlobCallback) => void;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let shareSpy: ReturnType<typeof vi.fn>;
  let canShareSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockContext = createMockContext();
    toBlobImpl = (callback) => callback(new Blob(["png"], { type: "image/png" }));

    anchorClickSpy = vi.fn();
    createObjectURLSpy = vi.fn<(obj: Blob | MediaSource) => string>(() => "blob:careflow");
    revokeObjectURLSpy = vi.fn<(url: string) => void>();
    shareSpy = vi.fn().mockResolvedValue(undefined);
    canShareSpy = vi.fn(() => false);

    URL.createObjectURL = createObjectURLSpy as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLSpy as typeof URL.revokeObjectURL;
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: canShareSpy,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: shareSpy,
    });

    createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: vi.fn((callback: BlobCallback) => toBlobImpl(callback)),
        } as unknown as HTMLCanvasElement;
      }

      if (tagName === "a") {
        const anchor = originalCreateElement("a");
        anchor.click = anchorClickSpy;
        return anchor;
      }

      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: originalCanShare,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: originalShare,
    });
  });

  it("shares the generated image when the Web Share API supports files", async () => {
    canShareSpy.mockReturnValue(true);

    await exportRouteImage(buildResult(), "2026-03-26", {
      breakGapThresholdMinutes: 30,
      lunchStartTime: "10:30",
      lunchDurationMinutes: 90,
    });

    expect(canShareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: "Routefy Schedule",
    });
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(mockContext.fillText).toHaveBeenCalledWith("ROUTE TIMELINE", expect.any(Number), 156);
  });

  it("falls back to a download link when file sharing is unavailable", async () => {
    await exportRouteImage(buildResult(), "2026-03-26", {
      breakGapThresholdMinutes: 30,
      lunchStartTime: "10:30",
      lunchDurationMinutes: 90,
    });

    expect(shareSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:careflow");
  });

  it("resolves when the user cancels the native share sheet", async () => {
    canShareSpy.mockReturnValue(true);
    shareSpy.mockRejectedValue(new DOMException("Share canceled", "AbortError"));

    await expect(exportRouteImage(buildResult(), "2026-03-26")).resolves.toBeUndefined();
  });

  it("rejects when the canvas context is unavailable", async () => {
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => null),
          toBlob: vi.fn(),
        } as unknown as HTMLCanvasElement;
      }

      return originalCreateElement(tagName);
    });

    await expect(exportRouteImage(buildResult(), "2026-03-26")).rejects.toThrow(
      "Canvas 2D context unavailable",
    );
  });

  it("rejects when blob generation fails", async () => {
    toBlobImpl = (callback) => callback(null);

    await expect(exportRouteImage(buildResult(), "2026-03-26")).rejects.toThrow(
      "Failed to generate image blob",
    );
  });
});
