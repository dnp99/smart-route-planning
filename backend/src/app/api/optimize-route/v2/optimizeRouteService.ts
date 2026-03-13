import { HttpError } from "../../../../lib/http";
import { geocodeTargetsSequentially, normalizeAddressKey } from "../geocoding";
import { buildDrivingRoute } from "../routing";
import type { GeocodedStop as LegacyGeocodedStop, OrderedStop as LegacyOrderedStop } from "../types";
import type {
  LatLng,
  OptimizeRouteResultV2,
  TaskResultV2,
  UnscheduledTaskV2,
  VisitV2,
} from "./types";
import type { ValidatedOptimizeRouteV2Request } from "./validation";

const AVERAGE_SPEED_KM_PER_HOUR = 35;
const ALGORITHM_VERSION = "v2.1.0-greedy-window-first";

type GeocodeTarget = {
  address: string;
  googlePlaceId?: string | null;
};

type VisitWithCoords = VisitV2 & {
  coords: LatLng;
  locationKey: string;
  windowStartSeconds: number;
  windowEndSeconds: number;
};

type PlannedStop = {
  stopId: string;
  address: string;
  coords: LatLng;
  locationKey: string;
  tasks: VisitWithCoords[];
  isEndingPoint?: boolean;
};

type CandidateScore = {
  fixedViolation: number;
  fixedLateSeconds: number;
  windowPriority: number;
  windowEndSeconds: number;
  flexibleLateSeconds: number;
  waitSeconds: number;
  travelSeconds: number;
  travelDistanceMeters: number;
  visitId: string;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistanceKm = (from: LatLng, to: LatLng) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(fromLat) * Math.cos(toLat);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const estimateTravelSeconds = (from: LatLng, to: LatLng) => {
  const distanceKm = haversineDistanceKm(from, to);
  if (distanceKm === 0) {
    return 0;
  }

  return Math.round((distanceKm / AVERAGE_SPEED_KM_PER_HOUR) * 3600);
};

const parseTimeToSeconds = (value: string) => {
  const [hourString, minuteString] = value.split(":");
  return Number(hourString) * 3600 + Number(minuteString) * 60;
};

const resolveLocationKey = ({ address, googlePlaceId }: GeocodeTarget) => {
  if (googlePlaceId && googlePlaceId.trim().length > 0) {
    return `place:${googlePlaceId.trim()}`;
  }

  return `address:${normalizeAddressKey(address)}`;
};

const getLocalSecondsOfDay = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const second = Number(parts.find((part) => part.type === "second")?.value ?? "0");

  return hour * 3600 + minute * 60 + second;
};

const compareScores = (left: CandidateScore, right: CandidateScore) => {
  const leftValues: Array<number | string> = [
    left.fixedViolation,
    left.fixedLateSeconds,
    left.windowPriority,
    left.windowEndSeconds,
    left.flexibleLateSeconds,
    left.waitSeconds,
    left.travelSeconds,
    left.travelDistanceMeters,
    left.visitId,
  ];
  const rightValues: Array<number | string> = [
    right.fixedViolation,
    right.fixedLateSeconds,
    right.windowPriority,
    right.windowEndSeconds,
    right.flexibleLateSeconds,
    right.waitSeconds,
    right.travelSeconds,
    right.travelDistanceMeters,
    right.visitId,
  ];

  for (let index = 0; index < leftValues.length; index += 1) {
    const leftValue = leftValues[index];
    const rightValue = rightValues[index];

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      if (leftValue < rightValue) {
        return -1;
      }
      if (leftValue > rightValue) {
        return 1;
      }
      continue;
    }

    const leftNumber = leftValue as number;
    const rightNumber = rightValue as number;
    if (leftNumber < rightNumber) {
      return -1;
    }
    if (leftNumber > rightNumber) {
      return 1;
    }
  }

  return 0;
};

const buildCandidateScore = (
  visit: VisitWithCoords,
  currentCoords: LatLng,
  currentLocalSeconds: number,
): CandidateScore => {
  const travelSeconds = estimateTravelSeconds(currentCoords, visit.coords);
  const travelDistanceMeters = Math.round(haversineDistanceKm(currentCoords, visit.coords) * 1000);
  const arrivalSeconds = currentLocalSeconds + travelSeconds;
  const waitSeconds = Math.max(0, visit.windowStartSeconds - arrivalSeconds);
  const serviceStartSeconds = arrivalSeconds + waitSeconds;
  const lateSeconds = Math.max(0, serviceStartSeconds - visit.windowEndSeconds);
  const isFixed = visit.windowType === "fixed";

  return {
    fixedViolation: isFixed && lateSeconds > 0 ? 1 : 0,
    fixedLateSeconds: isFixed ? lateSeconds : 0,
    windowPriority: isFixed ? 0 : 1,
    windowEndSeconds: visit.windowEndSeconds,
    flexibleLateSeconds: isFixed ? 0 : lateSeconds,
    waitSeconds,
    travelSeconds,
    travelDistanceMeters,
    visitId: visit.visitId,
  };
};

const chooseNextVisit = (
  remainingVisits: VisitWithCoords[],
  currentCoords: LatLng,
  currentLocalSeconds: number,
) => {
  let bestIndex = 0;
  let bestScore = buildCandidateScore(remainingVisits[0], currentCoords, currentLocalSeconds);

  for (let index = 1; index < remainingVisits.length; index += 1) {
    const candidate = remainingVisits[index];
    const score = buildCandidateScore(candidate, currentCoords, currentLocalSeconds);
    if (compareScores(score, bestScore) < 0) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return { bestIndex, bestScore };
};

const groupVisitsIntoStops = (orderedVisits: VisitWithCoords[], end: GeocodeTarget & { coords: LatLng }) => {
  const stops: PlannedStop[] = [];

  orderedVisits.forEach((visit) => {
    const previous = stops[stops.length - 1];
    if (previous && previous.locationKey === visit.locationKey) {
      previous.tasks.push(visit);
      return;
    }

    stops.push({
      stopId: `stop-${stops.length + 1}`,
      address: visit.address,
      coords: visit.coords,
      locationKey: visit.locationKey,
      tasks: [visit],
    });
  });

  const endLocationKey = resolveLocationKey(end);
  const lastStop = stops[stops.length - 1];
  if (lastStop && lastStop.locationKey === endLocationKey) {
    lastStop.isEndingPoint = true;
    return stops;
  }

  stops.push({
    stopId: `stop-${stops.length + 1}`,
    address: end.address,
    coords: end.coords,
    locationKey: endLocationKey,
    tasks: [],
    isEndingPoint: true,
  });

  return stops;
};

const toIsoFromLocalSeconds = (
  localSeconds: number,
  departureLocalSeconds: number,
  departureTimestampMs: number,
) => {
  const deltaSeconds = localSeconds - departureLocalSeconds;
  return new Date(departureTimestampMs + Math.round(deltaSeconds * 1000)).toISOString();
};

const resolveCoordsOrThrow = (lookup: Map<string, LatLng>, target: GeocodeTarget) => {
  const key = resolveLocationKey(target);
  const coords = lookup.get(key);
  if (!coords) {
    throw new HttpError(500, "Route geocoding data is incomplete.");
  }

  return coords;
};

const geocodeLocations = async (
  request: ValidatedOptimizeRouteV2Request,
  googleMapsApiKey: string,
) => {
  const geocodeTargetsByLocationKey = new Map<string, GeocodeTarget>();

  const registerTarget = (target: GeocodeTarget) => {
    const key = resolveLocationKey(target);
    const existing = geocodeTargetsByLocationKey.get(key);

    if (!existing) {
      geocodeTargetsByLocationKey.set(key, target);
      return;
    }

    if (!existing.googlePlaceId && target.googlePlaceId) {
      existing.googlePlaceId = target.googlePlaceId;
    }
  };

  registerTarget(request.start);
  request.visits.forEach((visit) => {
    registerTarget(visit);
  });
  registerTarget(request.end);

  const uniqueTargets = [...geocodeTargetsByLocationKey.values()];
  const geocodedTargets = await geocodeTargetsSequentially(uniqueTargets, googleMapsApiKey);

  const coordsByLocationKey = new Map<string, LatLng>();
  uniqueTargets.forEach((target, index) => {
    const geocoded = geocodedTargets[index];
    if (!geocoded) {
      throw new HttpError(500, "Route geocoding data is incomplete.");
    }

    coordsByLocationKey.set(resolveLocationKey(target), geocoded.coords);
  });

  return coordsByLocationKey;
};

const orderVisitsWindowFirst = (
  visits: VisitWithCoords[],
  startCoords: LatLng,
  departureLocalSeconds: number,
) => {
  const remaining = [...visits];
  const ordered: VisitWithCoords[] = [];
  const unscheduledTasks: UnscheduledTaskV2[] = [];
  let currentCoords = startCoords;
  let currentLocalSeconds = departureLocalSeconds;

  while (remaining.length > 0) {
    const { bestIndex, bestScore } = chooseNextVisit(remaining, currentCoords, currentLocalSeconds);
    const [selected] = remaining.splice(bestIndex, 1);

    if (selected.windowType === "fixed" && bestScore.fixedViolation > 0) {
      unscheduledTasks.push({
        visitId: selected.visitId,
        patientId: selected.patientId,
        reason: "fixed_window_unreachable",
      });
      continue;
    }

    const arrivalSeconds = currentLocalSeconds + bestScore.travelSeconds;
    const serviceStartSeconds = Math.max(arrivalSeconds, selected.windowStartSeconds);
    currentLocalSeconds = serviceStartSeconds + selected.serviceDurationMinutes * 60;
    currentCoords = selected.coords;
    ordered.push(selected);
  }

  return {
    orderedVisits: ordered,
    unscheduledTasks,
  };
};

const buildDrivingPayloadStops = (stops: PlannedStop[]): LegacyOrderedStop[] =>
  stops.map((stop) => ({
    address: stop.address,
    coords: stop.coords,
    distanceFromPreviousKm: 0,
    durationFromPreviousSeconds: 0,
    isEndingPoint: stop.isEndingPoint,
  }));

const buildTaskResult = (
  task: VisitWithCoords,
  arrivalLocalSeconds: number,
  departureLocalSeconds: number,
  departureTimestampMs: number,
): { taskResult: TaskResultV2; serviceEndSeconds: number } => {
  const waitSeconds = Math.max(0, task.windowStartSeconds - arrivalLocalSeconds);
  const serviceStartSeconds = arrivalLocalSeconds + waitSeconds;
  const lateBySeconds = Math.max(0, serviceStartSeconds - task.windowEndSeconds);
  const serviceEndSeconds = serviceStartSeconds + task.serviceDurationMinutes * 60;

  return {
    taskResult: {
      visitId: task.visitId,
      patientId: task.patientId,
      patientName: task.patientName,
      address: task.address,
      ...(task.googlePlaceId !== undefined ? { googlePlaceId: task.googlePlaceId } : {}),
      windowStart: task.windowStart,
      windowEnd: task.windowEnd,
      windowType: task.windowType,
      serviceDurationMinutes: task.serviceDurationMinutes,
      arrivalTime: toIsoFromLocalSeconds(arrivalLocalSeconds, departureLocalSeconds, departureTimestampMs),
      serviceStartTime: toIsoFromLocalSeconds(serviceStartSeconds, departureLocalSeconds, departureTimestampMs),
      serviceEndTime: toIsoFromLocalSeconds(serviceEndSeconds, departureLocalSeconds, departureTimestampMs),
      waitSeconds,
      lateBySeconds,
      onTime: lateBySeconds === 0,
    },
    serviceEndSeconds,
  };
};

export const optimizeRouteV2 = async (
  request: ValidatedOptimizeRouteV2Request,
  googleMapsApiKey: string,
): Promise<OptimizeRouteResultV2> => {
  const coordsByLocationKey = await geocodeLocations(request, googleMapsApiKey);
  const startCoords = resolveCoordsOrThrow(coordsByLocationKey, request.start);
  const endCoords = resolveCoordsOrThrow(coordsByLocationKey, request.end);

  const visitsWithCoords: VisitWithCoords[] = request.visits.map((visit) => ({
    ...visit,
    coords: resolveCoordsOrThrow(coordsByLocationKey, visit),
    locationKey: resolveLocationKey(visit),
    windowStartSeconds: parseTimeToSeconds(visit.windowStart),
    windowEndSeconds: parseTimeToSeconds(visit.windowEnd),
  }));

  const departureDate = new Date(request.start.departureTime);
  const departureTimestampMs = departureDate.getTime();
  const departureLocalSeconds = getLocalSecondsOfDay(departureDate, request.timezone);

  const { orderedVisits, unscheduledTasks } = orderVisitsWindowFirst(
    visitsWithCoords,
    startCoords,
    departureLocalSeconds,
  );
  const plannedStops = groupVisitsIntoStops(orderedVisits, {
    address: request.end.address,
    googlePlaceId: request.end.googlePlaceId,
    coords: endCoords,
  });

  const legacyStart: LegacyGeocodedStop = {
    address: request.start.address,
    coords: startCoords,
  };
  const drivingRoute = await buildDrivingRoute(
    legacyStart,
    buildDrivingPayloadStops(plannedStops),
    googleMapsApiKey,
  );

  const routeLegs = drivingRoute.routeLegs.map((leg, index) => ({
    fromStopId: index === 0 ? "start" : plannedStops[index - 1].stopId,
    toStopId: plannedStops[index]?.stopId ?? "end",
    fromAddress: leg.fromAddress,
    toAddress: leg.toAddress,
    distanceMeters: leg.distanceMeters,
    durationSeconds: leg.durationSeconds,
    encodedPolyline: leg.encodedPolyline,
  }));

  let cursorLocalSeconds = departureLocalSeconds;
  let fixedWindowViolations = 0;
  let totalLateSeconds = 0;
  let totalWaitSeconds = 0;

  const orderedStops = plannedStops.map((stop, index) => {
    const legDurationSeconds = drivingRoute.routeLegs[index]?.durationSeconds ?? 0;
    cursorLocalSeconds += legDurationSeconds;
    const stopArrivalLocalSeconds = cursorLocalSeconds;

    const tasks = stop.tasks.map((task) => {
      const { taskResult, serviceEndSeconds } = buildTaskResult(
        task,
        cursorLocalSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      );
      cursorLocalSeconds = serviceEndSeconds;

      totalWaitSeconds += taskResult.waitSeconds;
      totalLateSeconds += taskResult.lateBySeconds;
      if (taskResult.windowType === "fixed" && taskResult.lateBySeconds > 0) {
        fixedWindowViolations += 1;
      }

      return taskResult;
    });

    return {
      stopId: stop.stopId,
      address: stop.address,
      coords: stop.coords,
      arrivalTime: toIsoFromLocalSeconds(
        stopArrivalLocalSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      ),
      departureTime: toIsoFromLocalSeconds(cursorLocalSeconds, departureLocalSeconds, departureTimestampMs),
      tasks,
      distanceFromPreviousKm: drivingRoute.orderedStops[index]?.distanceFromPreviousKm ?? 0,
      durationFromPreviousSeconds: drivingRoute.orderedStops[index]?.durationFromPreviousSeconds ?? 0,
      ...(stop.isEndingPoint ? { isEndingPoint: true } : {}),
    };
  });

  return {
    start: {
      address: request.start.address,
      coords: startCoords,
      departureTime: request.start.departureTime,
    },
    end: {
      address: request.end.address,
      coords: endCoords,
    },
    orderedStops,
    routeLegs,
    unscheduledTasks,
    metrics: {
      fixedWindowViolations: fixedWindowViolations + unscheduledTasks.length,
      totalLateSeconds,
      totalWaitSeconds,
      totalDistanceMeters: drivingRoute.totalDistanceMeters,
      totalDistanceKm: drivingRoute.totalDistanceKm,
      totalDurationSeconds: drivingRoute.totalDurationSeconds,
    },
    algorithmVersion: ALGORITHM_VERSION,
  };
};
