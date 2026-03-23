const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type OptimizeRouteV2WindowType = "fixed" | "flexible";

export type NurseWorkingHoursConstraint = {
  workStart: string; // HH:mm
  workEnd: string; // HH:mm
  lunchDurationMinutes?: number;
};

export type OptimizeRouteV2LatLng = {
  lat: number;
  lon: number;
};

export type OptimizeRouteV2Visit = {
  visitId: string;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: OptimizeRouteV2WindowType;
  serviceDurationMinutes: number;
  priority?: number;
};

export type OptimizeRouteV2Request = {
  planningDate: string;
  timezone: string;
  start: {
    address: string;
    googlePlaceId?: string | null;
    departureTime?: string;
  };
  end: {
    address: string;
    googlePlaceId?: string | null;
  };
  visits: OptimizeRouteV2Visit[];
  preserveOrder?: boolean;
  nurseWorkingHours?: NurseWorkingHoursConstraint;
};

export type OptimizeRouteV2TaskResult = {
  visitId: string;
  patientId: string;
  patientName: string;
  address: string;
  googlePlaceId?: string | null;
  windowStart: string;
  windowEnd: string;
  windowType: OptimizeRouteV2WindowType;
  serviceDurationMinutes: number;
  arrivalTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  waitSeconds: number;
  lateBySeconds: number;
  onTime: boolean;
};

export type OptimizeRouteV2OrderedStop = {
  stopId: string;
  address: string;
  coords: OptimizeRouteV2LatLng;
  arrivalTime: string;
  departureTime: string;
  tasks: OptimizeRouteV2TaskResult[];
  distanceFromPreviousKm: number;
  durationFromPreviousSeconds: number;
  isEndingPoint?: boolean;
};

export type OptimizeRouteV2UnscheduledTask = {
  visitId: string;
  patientId: string;
  reason:
    | "fixed_window_unreachable"
    | "invalid_window"
    | "duration_exceeds_window"
    | "insufficient_day_capacity";
};

export type OptimizeRouteV2ScheduleWarning =
  | {
      type: "fixed_late" | "flexible_late";
      patientId: string;
      patientName: string;
      message: string;
    }
  | {
      type: "window_conflict";
      patientIds: [string, string];
      patientNames: [string, string];
      message: string;
    }
  | {
      type: "outside_working_hours";
      overByMinutes: number;
      message: string;
    }
  | {
      type: "lunch_skipped";
      message: string;
    };

export type OptimizeRouteV2RouteLeg = {
  fromStopId: string;
  toStopId: string;
  fromAddress: string;
  toAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

export type OptimizeRouteV2Response = {
  start: {
    address: string;
    coords: OptimizeRouteV2LatLng;
    departureTime: string;
  };
  end: {
    address: string;
    coords: OptimizeRouteV2LatLng;
  };
  orderedStops: OptimizeRouteV2OrderedStop[];
  routeLegs: OptimizeRouteV2RouteLeg[];
  unscheduledTasks: OptimizeRouteV2UnscheduledTask[];
  warnings?: OptimizeRouteV2ScheduleWarning[];
  metrics: {
    fixedWindowViolations: number;
    totalLateSeconds: number;
    totalWaitSeconds: number;
    totalDistanceMeters: number;
    totalDistanceKm: number;
    totalDurationSeconds: number;
  };
  algorithmVersion: string;
};

const isWindowType = (value: unknown): value is OptimizeRouteV2WindowType =>
  value === "fixed" || value === "flexible";

const isLatLng = (value: unknown): value is OptimizeRouteV2LatLng =>
  isObject(value) &&
  typeof value.lat === "number" &&
  Number.isFinite(value.lat) &&
  typeof value.lon === "number" &&
  Number.isFinite(value.lon);

const isOptionalStringOrNull = (value: unknown) =>
  value === undefined || value === null || typeof value === "string";

const isVisit = (value: unknown): value is OptimizeRouteV2Visit => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.visitId !== "string" ||
    typeof value.patientId !== "string" ||
    typeof value.patientName !== "string" ||
    typeof value.address !== "string" ||
    typeof value.windowStart !== "string" ||
    typeof value.windowEnd !== "string" ||
    !isWindowType(value.windowType) ||
    typeof value.serviceDurationMinutes !== "number"
  ) {
    return false;
  }

  if (!isOptionalStringOrNull(value.googlePlaceId)) {
    return false;
  }

  if (value.priority !== undefined && typeof value.priority !== "number") {
    return false;
  }

  return true;
};

const isTaskResult = (value: unknown): value is OptimizeRouteV2TaskResult => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.visitId !== "string" ||
    typeof value.patientId !== "string" ||
    typeof value.patientName !== "string" ||
    typeof value.address !== "string" ||
    typeof value.windowStart !== "string" ||
    typeof value.windowEnd !== "string" ||
    !isWindowType(value.windowType) ||
    typeof value.serviceDurationMinutes !== "number" ||
    typeof value.arrivalTime !== "string" ||
    typeof value.serviceStartTime !== "string" ||
    typeof value.serviceEndTime !== "string" ||
    typeof value.waitSeconds !== "number" ||
    typeof value.lateBySeconds !== "number" ||
    typeof value.onTime !== "boolean"
  ) {
    return false;
  }

  return isOptionalStringOrNull(value.googlePlaceId);
};

const isOrderedStop = (value: unknown): value is OptimizeRouteV2OrderedStop => {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.stopId !== "string" ||
    typeof value.address !== "string" ||
    !isLatLng(value.coords) ||
    typeof value.arrivalTime !== "string" ||
    typeof value.departureTime !== "string" ||
    !Array.isArray(value.tasks) ||
    value.tasks.some((task) => !isTaskResult(task)) ||
    typeof value.distanceFromPreviousKm !== "number" ||
    typeof value.durationFromPreviousSeconds !== "number"
  ) {
    return false;
  }

  if (value.isEndingPoint !== undefined && typeof value.isEndingPoint !== "boolean") {
    return false;
  }

  return true;
};

const isRouteLeg = (value: unknown): value is OptimizeRouteV2RouteLeg => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.fromStopId === "string" &&
    typeof value.toStopId === "string" &&
    typeof value.fromAddress === "string" &&
    typeof value.toAddress === "string" &&
    typeof value.distanceMeters === "number" &&
    typeof value.durationSeconds === "number" &&
    typeof value.encodedPolyline === "string"
  );
};

const isScheduleWarning = (value: unknown): value is OptimizeRouteV2ScheduleWarning => {
  if (!isObject(value) || typeof value.message !== "string") {
    return false;
  }

  if (value.type === "window_conflict") {
    return (
      Array.isArray(value.patientIds) &&
      value.patientIds.length === 2 &&
      typeof value.patientIds[0] === "string" &&
      typeof value.patientIds[1] === "string" &&
      Array.isArray(value.patientNames) &&
      value.patientNames.length === 2 &&
      typeof value.patientNames[0] === "string" &&
      typeof value.patientNames[1] === "string"
    );
  }

  if (value.type === "fixed_late" || value.type === "flexible_late") {
    return typeof value.patientId === "string" && typeof value.patientName === "string";
  }

  if (value.type === "outside_working_hours") {
    return typeof value.overByMinutes === "number";
  }

  if (value.type === "lunch_skipped") {
    return true;
  }

  return false;
};

const isUnscheduledTask = (value: unknown): value is OptimizeRouteV2UnscheduledTask => {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.visitId !== "string" || typeof value.patientId !== "string") {
    return false;
  }

  return (
    value.reason === "fixed_window_unreachable" ||
    value.reason === "invalid_window" ||
    value.reason === "duration_exceeds_window" ||
    value.reason === "insufficient_day_capacity"
  );
};

export const isOptimizeRouteV2Request = (payload: unknown): payload is OptimizeRouteV2Request => {
  if (!isObject(payload) || !isObject(payload.start) || !isObject(payload.end)) {
    return false;
  }

  if (
    typeof payload.planningDate !== "string" ||
    typeof payload.timezone !== "string" ||
    typeof payload.start.address !== "string" ||
    typeof payload.end.address !== "string"
  ) {
    return false;
  }

  if (
    payload.start.departureTime !== undefined &&
    typeof payload.start.departureTime !== "string"
  ) {
    return false;
  }

  if (!isOptionalStringOrNull(payload.start.googlePlaceId)) {
    return false;
  }

  if (!isOptionalStringOrNull(payload.end.googlePlaceId)) {
    return false;
  }

  if (!Array.isArray(payload.visits) || payload.visits.some((visit) => !isVisit(visit))) {
    return false;
  }

  if (payload.preserveOrder !== undefined && typeof payload.preserveOrder !== "boolean") {
    return false;
  }

  if (payload.nurseWorkingHours !== undefined) {
    if (
      !isObject(payload.nurseWorkingHours) ||
      typeof payload.nurseWorkingHours.workStart !== "string" ||
      typeof payload.nurseWorkingHours.workEnd !== "string"
    ) {
      return false;
    }
  }

  return true;
};

export const parseOptimizeRouteV2Response = (payload: unknown): OptimizeRouteV2Response | null => {
  if (!isObject(payload) || !isObject(payload.start) || !isObject(payload.end) || !isObject(payload.metrics)) {
    return null;
  }

  if (
    typeof payload.start.address !== "string" ||
    !isLatLng(payload.start.coords) ||
    typeof payload.start.departureTime !== "string" ||
    typeof payload.end.address !== "string" ||
    !isLatLng(payload.end.coords)
  ) {
    return null;
  }

  if (
    typeof payload.metrics.fixedWindowViolations !== "number" ||
    typeof payload.metrics.totalLateSeconds !== "number" ||
    typeof payload.metrics.totalWaitSeconds !== "number" ||
    typeof payload.metrics.totalDistanceMeters !== "number" ||
    typeof payload.metrics.totalDistanceKm !== "number" ||
    typeof payload.metrics.totalDurationSeconds !== "number"
  ) {
    return null;
  }

  if (
    !Array.isArray(payload.orderedStops) ||
    payload.orderedStops.some((stop) => !isOrderedStop(stop)) ||
    !Array.isArray(payload.routeLegs) ||
    payload.routeLegs.some((leg) => !isRouteLeg(leg)) ||
    !Array.isArray(payload.unscheduledTasks) ||
    payload.unscheduledTasks.some((task) => !isUnscheduledTask(task)) ||
    typeof payload.algorithmVersion !== "string"
  ) {
    return null;
  }

  if (
    payload.warnings !== undefined &&
    (!Array.isArray(payload.warnings) ||
      payload.warnings.some((warning) => !isScheduleWarning(warning)))
  ) {
    return null;
  }

  return payload as OptimizeRouteV2Response;
};
