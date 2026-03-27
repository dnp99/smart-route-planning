import { HttpError } from "../../../../lib/http";
import { geocodeTargetsSequentially, normalizeAddressKey } from "../geocoding";
import { buildDrivingRoute } from "../routing";
import type {
  GeocodedStop as LegacyGeocodedStop,
  OrderedStop as LegacyOrderedStop,
} from "../types";
import type {
  LatLng,
  OptimizeRouteResultV2,
  ScheduleWarningV2,
  TaskResultV2,
  UnscheduledTaskV2,
  VisitV2,
} from "../v2/types";
import type { ValidatedOptimizeRouteV2Request } from "../v2/validation";
import {
  buildPlanningTravelDurationMatrix,
  type TravelDurationMatrix,
  type TravelMatrixNode,
} from "../v2/travelMatrix";

const ALGORITHM_VERSION = "v3.0.0-ils-seeded";
const FIXED_LATE_TOLERANCE_SECONDS = 15 * 60;
const FLEXIBLE_LATE_TOLERANCE_SECONDS = 60 * 60;
const FLEXIBLE_URGENCY_THRESHOLD_SECONDS = 90 * 60;
const ESTIMATED_DRIVE_SPEED_KM_PER_HOUR = 40;
const IDLE_GAP_FILL_THRESHOLD_SECONDS = 30 * 60;
const IDLE_GAP_RETURN_BUFFER_SECONDS = 5 * 60;
const IDLE_GAP_FILLER_MAX_WAIT_SECONDS = 10 * 60;
const IDLE_GAP_MIN_UTILIZATION_SECONDS = 15 * 60;
const DEPARTURE_BUFFER_SECONDS = 10 * 60;
const DEFAULT_UNANCHORED_DEPARTURE_LOCAL_SECONDS = 8 * 3600;
const SYNTHETIC_WINDOW_START_SECONDS = 0;
const SYNTHETIC_WINDOW_END_SECONDS = 23 * 3600 + 59 * 60;
const PLANNING_DAY_END_SECONDS = 24 * 3600 - 1;
const LOOKAHEAD_DEPTH = 2;
const LOOKAHEAD_BEAM_WIDTH = 8;
const MAX_MATRIX_NODES = 25;
const ILS_TIME_LIMIT_MS = 500;
const MAX_ILS_ITERATIONS = 128;
const DISTANCE_IDLE_GAP_THRESHOLD_SECONDS = 45 * 60;
const DISTANCE_IDLE_TRAVEL_TOLERANCE_SECONDS = 6 * 60;
const DISTANCE_IDLE_PENALTY_MULTIPLIER = 100;
const DISTANCE_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS = 45 * 60;
const TIME_IDLE_GAP_THRESHOLD_SECONDS = 30 * 60;
const TIME_IDLE_ELAPSED_TOLERANCE_SECONDS = 10 * 60;
const TIME_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS = 30 * 60;

export type OptimizeRouteV3ShadowContext = {
  requestId: string;
  nurseId: string;
  shadowCompare: boolean;
};

type GeocodeTarget = {
  address: string;
  googlePlaceId?: string | null;
};

type VisitWithCoords = VisitV2 & {
  coords: LatLng;
  locationKey: string;
  hasPreferredWindow: boolean;
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

type LocationRef = {
  coords: LatLng;
  locationKey: string;
};

type RandomSource = () => number;

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

const parseTimeToSeconds = (value: string) => {
  const [hourString, minuteString] = value.split(":");
  return Number(hourString) * 3600 + Number(minuteString) * 60;
};

const hashRequestIdToSeed = (requestId: string) => {
  // 32-bit FNV-1a hash for stable seed derivation.
  let hash = 0x811c9dc5;
  for (let index = 0; index < requestId.length; index += 1) {
    hash ^= requestId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 0x9e3779b9;
};

const createSeededRng = (seed: number): RandomSource => {
  let state = seed >>> 0;
  return () => {
    // Mulberry32: compact deterministic PRNG with acceptable quality for
    // perturbation diversification in heuristic search.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const parsePlanningDateParts = (planningDate: string) => {
  const [yearString, monthString, dayString] = planningDate.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (year !== year || month !== month || day !== day) {
    throw new HttpError(400, "planningDate must be a valid calendar date.");
  }

  return { year, month, day };
};

const parseOffsetMinutesFromTimeZoneName = (value: string) => {
  if (value === "GMT" || value === "UTC") {
    return 0;
  }

  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  if (hours !== hours || minutes !== minutes) {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return sign * (hours * 60 + minutes);
};

const resolveTimeZoneOffsetMinutes = (timestampMs: number, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));

  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;
  if (!timeZoneName) {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return parseOffsetMinutesFromTimeZoneName(timeZoneName);
};

const toIsoFromPlanningDateAndLocalSeconds = (
  planningDate: string,
  timezone: string,
  localSeconds: number,
) => {
  const { year, month, day } = parsePlanningDateParts(planningDate);
  const safeSeconds = Math.max(0, Math.min(24 * 3600 - 1, Math.floor(localSeconds)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const utcGuessMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, 0);

  let offsetMinutes = resolveTimeZoneOffsetMinutes(utcGuessMs, timezone);
  let timestampMs = utcGuessMs - offsetMinutes * 60 * 1000;
  const refinedOffsetMinutes = resolveTimeZoneOffsetMinutes(timestampMs, timezone);

  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    timestampMs = utcGuessMs - offsetMinutes * 60 * 1000;
  }

  return new Date(timestampMs).toISOString();
};

const groupVisitsIntoStops = (
  orderedVisits: VisitWithCoords[],
  end: GeocodeTarget & { coords: LatLng },
) => {
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

type VisitProjection = {
  visit: VisitWithCoords;
  travelSeconds: number;
  arrivalSeconds: number;
  serviceStartSeconds: number;
  serviceEndSeconds: number;
  waitSeconds: number;
  lateBySeconds: number;
  slackSeconds: number;
  score: ProjectionScore;
};

type ProjectionScore = {
  fixedLateCount: number;
  fixedLateSeconds: number;
  totalLateSeconds: number;
  totalWaitSeconds: number;
  totalTravelSeconds: number;
};

const estimateTravelSeconds = (distanceKm: number) =>
  Math.round((distanceKm / ESTIMATED_DRIVE_SPEED_KM_PER_HOUR) * 3600);

const minuteBucket = (seconds: number) => Math.floor(seconds / 60);

const computeMinuteAlignedLateBySeconds = (serviceEndSeconds: number, windowEndSeconds: number) => {
  const lateMinutes = Math.max(0, minuteBucket(serviceEndSeconds) - minuteBucket(windowEndSeconds));
  return lateMinutes * 60;
};

const resolveTravelSecondsFromMatrix = (
  travelDurationMatrix: TravelDurationMatrix | undefined,
  fromLocationKey: string,
  toLocationKey: string,
) => {
  if (!travelDurationMatrix) {
    return undefined;
  }

  return travelDurationMatrix.get(fromLocationKey)?.get(toLocationKey);
};

const buildTravelSecondsResolver = (travelDurationMatrix: TravelDurationMatrix | undefined) => {
  return (from: LocationRef, to: LocationRef) => {
    if (from.locationKey === to.locationKey) {
      return 0;
    }

    const matrixDuration = resolveTravelSecondsFromMatrix(
      travelDurationMatrix,
      from.locationKey,
      to.locationKey,
    );
    if (typeof matrixDuration === "number" && matrixDuration >= 0) {
      return matrixDuration;
    }

    return estimateTravelSeconds(haversineDistanceKm(from.coords, to.coords));
  };
};

const ZERO_SCORE: ProjectionScore = {
  fixedLateCount: 0,
  fixedLateSeconds: 0,
  totalLateSeconds: 0,
  totalWaitSeconds: 0,
  totalTravelSeconds: 0,
};

const addScores = (left: ProjectionScore, right: ProjectionScore): ProjectionScore => ({
  fixedLateCount: left.fixedLateCount + right.fixedLateCount,
  fixedLateSeconds: left.fixedLateSeconds + right.fixedLateSeconds,
  totalLateSeconds: left.totalLateSeconds + right.totalLateSeconds,
  totalWaitSeconds: left.totalWaitSeconds + right.totalWaitSeconds,
  totalTravelSeconds: left.totalTravelSeconds + right.totalTravelSeconds,
});

const compareScores = (
  left: ProjectionScore,
  right: ProjectionScore,
  objective: "time" | "distance",
) => {
  if (left.fixedLateCount !== right.fixedLateCount) {
    return left.fixedLateCount - right.fixedLateCount;
  }

  if (left.fixedLateSeconds !== right.fixedLateSeconds) {
    return left.fixedLateSeconds - right.fixedLateSeconds;
  }

  if (left.totalLateSeconds !== right.totalLateSeconds) {
    return left.totalLateSeconds - right.totalLateSeconds;
  }

  if (objective === "time") {
    // Finish sooner: minimize total elapsed time (wait + travel combined)
    return (
      left.totalWaitSeconds +
      left.totalTravelSeconds -
      (right.totalWaitSeconds + right.totalTravelSeconds)
    );
  }

  // Less driving: minimize travel first, accept more wait in exchange for fewer km
  if (left.totalTravelSeconds !== right.totalTravelSeconds) {
    return left.totalTravelSeconds - right.totalTravelSeconds;
  }

  return left.totalWaitSeconds - right.totalWaitSeconds;
};

const compareFixedLateness = (left: ProjectionScore, right: ProjectionScore) => {
  if (left.fixedLateCount !== right.fixedLateCount) {
    return left.fixedLateCount - right.fixedLateCount;
  }

  if (left.fixedLateSeconds !== right.fixedLateSeconds) {
    return left.fixedLateSeconds - right.fixedLateSeconds;
  }

  return 0;
};

const scoreProjection = (projection: Omit<VisitProjection, "score">): ProjectionScore => {
  const fixedLateSeconds = projection.visit.windowType === "fixed" ? projection.lateBySeconds : 0;

  return {
    fixedLateCount: fixedLateSeconds > 0 ? 1 : 0,
    fixedLateSeconds,
    totalLateSeconds: projection.lateBySeconds,
    totalWaitSeconds: projection.waitSeconds,
    totalTravelSeconds: projection.travelSeconds,
  };
};

const compareDepartureAnchors = (
  left: VisitWithCoords,
  right: VisitWithCoords,
  startLocation: LocationRef,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  objective: "time" | "distance",
) => {
  if (left.windowStartSeconds !== right.windowStartSeconds) {
    return left.windowStartSeconds - right.windowStartSeconds;
  }

  if (objective === "distance" && left.windowType !== right.windowType) {
    return left.windowType === "fixed" ? -1 : 1;
  }

  const leftTravelSeconds = resolveTravelSeconds(startLocation, left);
  const rightTravelSeconds = resolveTravelSeconds(startLocation, right);
  if (leftTravelSeconds !== rightTravelSeconds) {
    return leftTravelSeconds - rightTravelSeconds;
  }

  if (left.windowEndSeconds !== right.windowEndSeconds) {
    return left.windowEndSeconds - right.windowEndSeconds;
  }

  return left.visitId.localeCompare(right.visitId);
};

const resolveFirstDepartureAnchor = (
  visits: VisitWithCoords[],
  startLocation: LocationRef,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  objective: "time" | "distance",
) => {
  const anchoredVisits = visits.filter((visit) => visit.hasPreferredWindow);
  if (anchoredVisits.length === 0) {
    return null;
  }

  const sortedVisits = [...anchoredVisits];
  sortedVisits.sort((left, right) =>
    compareDepartureAnchors(left, right, startLocation, resolveTravelSeconds, objective),
  );

  return sortedVisits[0] ?? null;
};

const resolveTravelSecondsFromStartToVisit = async (
  request: ValidatedOptimizeRouteV2Request,
  startLocation: LocationRef,
  visit: VisitWithCoords,
  googleMapsApiKey: string,
  hasPlanningMatrix: boolean,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
) => {
  const fallbackEstimate = resolveTravelSeconds(startLocation, visit);

  if (hasPlanningMatrix) {
    return fallbackEstimate;
  }

  if (visit.locationKey === resolveLocationKey(request.start)) {
    return 0;
  }

  const startStop: LegacyGeocodedStop = {
    address: request.start.address,
    coords: startLocation.coords,
  };
  const targetStop: LegacyOrderedStop = {
    address: visit.address,
    coords: visit.coords,
    distanceFromPreviousKm: 0,
    durationFromPreviousSeconds: 0,
  };

  try {
    const routeToFirstStop = await buildDrivingRoute(startStop, [targetStop], googleMapsApiKey);
    const legDurationSeconds = routeToFirstStop.routeLegs[0]?.durationSeconds;
    if (typeof legDurationSeconds === "number" && legDurationSeconds >= 0) {
      return legDurationSeconds;
    }
  } catch {
    return fallbackEstimate;
  }

  return fallbackEstimate;
};

const resolveDepartureContext = async (
  request: ValidatedOptimizeRouteV2Request,
  visits: VisitWithCoords[],
  startLocation: LocationRef,
  googleMapsApiKey: string,
  hasPlanningMatrix: boolean,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  objective: "time" | "distance",
) => {
  if (request.start.departureTime) {
    const departureDate = new Date(request.start.departureTime);
    const departureTimestampMs = departureDate.getTime();
    const departureLocalSeconds = getLocalSecondsOfDay(departureDate, request.timezone);

    return {
      departureTime: request.start.departureTime,
      departureTimestampMs,
      departureLocalSeconds,
    };
  }

  const workStartSeconds = request.nurseWorkingHours
    ? parseTimeToSeconds(request.nurseWorkingHours.workStart)
    : undefined;

  const firstAnchor = resolveFirstDepartureAnchor(
    visits,
    startLocation,
    resolveTravelSeconds,
    objective,
  );
  const departureLocalSeconds = firstAnchor
    ? Math.max(
        0,
        firstAnchor.windowStartSeconds -
          (await resolveTravelSecondsFromStartToVisit(
            request,
            startLocation,
            firstAnchor,
            googleMapsApiKey,
            hasPlanningMatrix,
            resolveTravelSeconds,
          )) -
          DEPARTURE_BUFFER_SECONDS,
      )
    : visits.length > 0
      ? (workStartSeconds ?? DEFAULT_UNANCHORED_DEPARTURE_LOCAL_SECONDS)
      : 0;

  const departureTime = toIsoFromPlanningDateAndLocalSeconds(
    request.planningDate,
    request.timezone,
    departureLocalSeconds,
  );
  const departureTimestampMs = new Date(departureTime).getTime();

  return {
    departureTime,
    departureTimestampMs,
    departureLocalSeconds,
  };
};

const projectVisit = (
  visit: VisitWithCoords,
  from: LocationRef,
  fromTimeSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
): Omit<VisitProjection, "score"> => {
  const travelSeconds = resolveTravelSeconds(from, visit);
  const arrivalSeconds = fromTimeSeconds + travelSeconds;
  const serviceStartSeconds = Math.max(arrivalSeconds, visit.windowStartSeconds);
  const serviceEndSeconds = serviceStartSeconds + visit.serviceDurationMinutes * 60;
  const waitSeconds = Math.max(0, serviceStartSeconds - arrivalSeconds);
  const lateBySeconds = visit.hasPreferredWindow
    ? Math.max(0, serviceEndSeconds - visit.windowEndSeconds)
    : 0;
  const slackSeconds = visit.windowEndSeconds - serviceEndSeconds;

  return {
    visit,
    travelSeconds,
    arrivalSeconds,
    serviceStartSeconds,
    serviceEndSeconds,
    waitSeconds,
    lateBySeconds,
    slackSeconds,
  };
};

const evaluateFutureBestScore = (
  remainingVisits: VisitWithCoords[],
  from: LocationRef,
  fromTimeSeconds: number,
  depth: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  objective: "time" | "distance",
): ProjectionScore => {
  if (depth <= 0 || remainingVisits.length === 0) {
    return ZERO_SCORE;
  }

  const projectedCandidates = remainingVisits.map((visit) => {
    const projection = projectVisit(visit, from, fromTimeSeconds, resolveTravelSeconds);

    return {
      visit,
      projection,
      immediateScore: scoreProjection(projection),
    };
  });

  projectedCandidates.sort((left, right) => {
    const scoreComparison = compareScores(left.immediateScore, right.immediateScore, objective);
    if (scoreComparison !== 0) {
      return scoreComparison;
    }

    if (left.projection.serviceStartSeconds !== right.projection.serviceStartSeconds) {
      return left.projection.serviceStartSeconds - right.projection.serviceStartSeconds;
    }

    return left.visit.visitId.localeCompare(right.visit.visitId);
  });

  const beamCandidates = projectedCandidates.slice(0, LOOKAHEAD_BEAM_WIDTH);

  const futureCandidates = beamCandidates.map(({ visit, projection, immediateScore }) => {
    const remainingAfter = remainingVisits.filter(
      (candidate) => candidate.visitId !== visit.visitId,
    );

    const future = evaluateFutureBestScore(
      remainingAfter,
      visit,
      projection.serviceEndSeconds,
      depth - 1,
      resolveTravelSeconds,
      objective,
    );

    return {
      ...projection,
      score: addScores(immediateScore, future),
    };
  });

  futureCandidates.sort((left, right) => compareVisitProjections(left, right, objective));
  return futureCandidates[0]?.score ?? ZERO_SCORE;
};

const compareVisitProjections = (
  left: VisitProjection,
  right: VisitProjection,
  objective: "time" | "distance",
) => {
  const scoreComparison = compareScores(left.score, right.score, objective);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  if (left.serviceStartSeconds !== right.serviceStartSeconds) {
    return left.serviceStartSeconds - right.serviceStartSeconds;
  }

  if (left.waitSeconds !== right.waitSeconds) {
    return left.waitSeconds - right.waitSeconds;
  }

  if (left.travelSeconds !== right.travelSeconds) {
    return left.travelSeconds - right.travelSeconds;
  }

  if (left.slackSeconds !== right.slackSeconds) {
    return left.slackSeconds - right.slackSeconds;
  }

  if (left.visit.windowEndSeconds !== right.visit.windowEndSeconds) {
    return left.visit.windowEndSeconds - right.visit.windowEndSeconds;
  }

  return left.visit.visitId.localeCompare(right.visit.visitId);
};

type GapFillerCandidate = {
  projection: VisitProjection;
  anchorReturnTravelSeconds: number;
  anchorArrivalAfterFiller: number;
  gapUtilizationSeconds: number;
};

// Plans the full sequence of visits that fit within the idle gap before a fixed
// anchor, rather than picking one visit at a time. Uses nearest-neighbour with
// urgency-first ordering so that tight-window visits (e.g. Nasim 09:00-11:00)
// are served before wide-window or no-window visits (e.g. Dindyal 08:30-13:00,
// Catherine no-window) without leaving any of them stranded after the anchor.
const planGapWindowSequence = (
  anchor: VisitWithCoords,
  projections: VisitProjection[],
  currentTimeSeconds: number,
  currentLocation: LocationRef,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
): VisitWithCoords[] => {
  const sequence: VisitWithCoords[] = [];
  const remaining = projections
    .filter((p) => p.visit.visitId !== anchor.visitId && p.lateBySeconds === 0)
    .map((p) => p.visit);

  let loc: LocationRef = currentLocation;
  let time = currentTimeSeconds;

  while (remaining.length > 0) {
    const feasible = remaining
      .map((visit) => projectVisit(visit, loc, time, resolveTravelSeconds))
      .filter((p) => {
        if (p.lateBySeconds > 0) return false;
        if (p.waitSeconds > IDLE_GAP_FILLER_MAX_WAIT_SECONDS) return false;
        const anchorReturnTravel = resolveTravelSeconds(p.visit, anchor);
        const anchorArrival = p.serviceEndSeconds + anchorReturnTravel;
        if (anchorArrival > anchor.windowStartSeconds - IDLE_GAP_RETURN_BUFFER_SECONDS) {
          return false;
        }

        // Safety guard: a candidate is invalid if taking it now would make any
        // remaining preferred-window visit immediately late from this state.
        const nextLocation: LocationRef = {
          coords: p.visit.coords,
          locationKey: p.visit.locationKey,
        };
        const wouldMakeOtherWindowLate = remaining
          .filter(
            (candidate) => candidate.visitId !== p.visit.visitId && candidate.hasPreferredWindow,
          )
          .some((candidate) => {
            const projected = projectVisit(
              candidate,
              nextLocation,
              p.serviceEndSeconds,
              resolveTravelSeconds,
            );
            return projected.lateBySeconds > 0;
          });

        return !wouldMakeOtherWindowLate;
      });

    if (feasible.length === 0) break;

    // Urgency-first: visits whose window closes soon come before wide/no-window visits
    const urgent = feasible.filter(
      (p) =>
        p.visit.hasPreferredWindow &&
        p.slackSeconds >= 0 &&
        p.slackSeconds < FLEXIBLE_URGENCY_THRESHOLD_SECONDS,
    );
    const pool = urgent.length > 0 ? urgent : feasible;

    // Within the pool: EDF (least slack first), then nearest travel
    pool.sort((a, b) => {
      const aSlack = a.visit.hasPreferredWindow ? a.slackSeconds : Number.MAX_SAFE_INTEGER;
      const bSlack = b.visit.hasPreferredWindow ? b.slackSeconds : Number.MAX_SAFE_INTEGER;
      return aSlack !== bSlack ? aSlack - bSlack : a.travelSeconds - b.travelSeconds;
    });

    const next = pool[0];
    if (!next) break;

    sequence.push(next.visit);
    loc = { coords: next.visit.coords, locationKey: next.visit.locationKey };
    time = next.serviceEndSeconds;

    const idx = remaining.findIndex((v) => v.visitId === next.visit.visitId);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  return sequence;
};

const compareGapFillerCandidates = (
  left: GapFillerCandidate,
  right: GapFillerCandidate,
  objective: "time" | "distance",
) => {
  // Urgency takes absolute priority over score — a no-window patient always has
  // zero late penalty so it will otherwise always outscore an urgent windowed
  // patient, causing the deadline to be missed even when the gap filler runs.
  const leftUrgent =
    left.projection.visit.hasPreferredWindow &&
    left.projection.slackSeconds < FLEXIBLE_URGENCY_THRESHOLD_SECONDS;
  const rightUrgent =
    right.projection.visit.hasPreferredWindow &&
    right.projection.slackSeconds < FLEXIBLE_URGENCY_THRESHOLD_SECONDS;
  if (leftUrgent !== rightUrgent) {
    return leftUrgent ? -1 : 1;
  }
  if (leftUrgent && rightUrgent) {
    if (left.projection.slackSeconds !== right.projection.slackSeconds) {
      return left.projection.slackSeconds - right.projection.slackSeconds;
    }
  }

  const projectionScoreComparison = compareScores(
    left.projection.score,
    right.projection.score,
    objective,
  );
  if (projectionScoreComparison !== 0) {
    return projectionScoreComparison;
  }

  if (left.gapUtilizationSeconds !== right.gapUtilizationSeconds) {
    return right.gapUtilizationSeconds - left.gapUtilizationSeconds;
  }

  if (left.anchorReturnTravelSeconds !== right.anchorReturnTravelSeconds) {
    return left.anchorReturnTravelSeconds - right.anchorReturnTravelSeconds;
  }

  if (left.projection.visit.windowEndSeconds !== right.projection.visit.windowEndSeconds) {
    return left.projection.visit.windowEndSeconds - right.projection.visit.windowEndSeconds;
  }

  return left.projection.visit.visitId.localeCompare(right.projection.visit.visitId);
};

const maybeSelectGapFiller = (
  selectedProjection: VisitProjection,
  projections: VisitProjection[],
  currentTimeSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  objective: "time" | "distance",
) => {
  if (selectedProjection.waitSeconds < IDLE_GAP_FILL_THRESHOLD_SECONDS) {
    return selectedProjection;
  }

  const anchor = selectedProjection.visit;
  // Less-driving mode still protects near-due fixed anchors. For far-future
  // fixed anchors, allow safe fillers to avoid extreme idle blocks.
  if (
    objective === "distance" &&
    anchor.windowType === "fixed" &&
    selectedProjection.waitSeconds <= DISTANCE_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS
  ) {
    return selectedProjection;
  }

  const latestAnchorArrivalSeconds = Math.max(
    currentTimeSeconds,
    anchor.windowStartSeconds - IDLE_GAP_RETURN_BUFFER_SECONDS,
  );

  const fillers = projections
    .filter((projection) => projection.visit.visitId !== anchor.visitId)
    .map((projection): GapFillerCandidate | null => {
      if (projection.waitSeconds > IDLE_GAP_FILLER_MAX_WAIT_SECONDS) {
        return null;
      }

      if (projection.lateBySeconds > 0) {
        return null;
      }

      const anchorReturnTravelSeconds = resolveTravelSeconds(projection.visit, anchor);

      const anchorArrivalAfterFiller = projection.serviceEndSeconds + anchorReturnTravelSeconds;
      if (anchorArrivalAfterFiller > latestAnchorArrivalSeconds) {
        return null;
      }

      const anchorServiceStartAfterFiller = Math.max(
        anchorArrivalAfterFiller,
        anchor.windowStartSeconds,
      );
      const anchorServiceEndAfterFiller =
        anchorServiceStartAfterFiller + anchor.serviceDurationMinutes * 60;
      const anchorLateAfterFiller = anchor.hasPreferredWindow
        ? Math.max(0, anchorServiceEndAfterFiller - anchor.windowEndSeconds)
        : 0;
      if (anchorLateAfterFiller > selectedProjection.lateBySeconds) {
        return null;
      }

      const gapUtilizationSeconds =
        projection.serviceEndSeconds + anchorReturnTravelSeconds - currentTimeSeconds;
      if (gapUtilizationSeconds < IDLE_GAP_MIN_UTILIZATION_SECONDS) {
        return null;
      }

      if (gapUtilizationSeconds > selectedProjection.waitSeconds - IDLE_GAP_RETURN_BUFFER_SECONDS) {
        return null;
      }

      return {
        projection,
        anchorReturnTravelSeconds,
        anchorArrivalAfterFiller,
        gapUtilizationSeconds,
      };
    })
    .filter((candidate): candidate is GapFillerCandidate => candidate !== null);

  if (fillers.length === 0) {
    return selectedProjection;
  }

  fillers.sort((left, right) => compareGapFillerCandidates(left, right, objective));
  return fillers[0]?.projection ?? selectedProjection;
};

const detectWindowConflicts = (
  fixedVisits: VisitWithCoords[],
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
): ScheduleWarningV2[] => {
  const warnings: ScheduleWarningV2[] = [];

  for (let i = 0; i < fixedVisits.length; i++) {
    for (let j = i + 1; j < fixedVisits.length; j++) {
      const a = fixedVisits[i];
      const b = fixedVisits[j];
      if (!a || !b) {
        continue;
      }

      const travelAtoB = resolveTravelSeconds(a, b);
      const aBeforeBFeasible =
        a.windowStartSeconds + a.serviceDurationMinutes * 60 + travelAtoB <= b.windowEndSeconds;

      const travelBtoA = resolveTravelSeconds(b, a);
      const bBeforeAFeasible =
        b.windowStartSeconds + b.serviceDurationMinutes * 60 + travelBtoA <= a.windowEndSeconds;

      if (!aBeforeBFeasible && !bBeforeAFeasible) {
        warnings.push({
          type: "window_conflict",
          patientIds: [a.patientId, b.patientId],
          patientNames: [a.patientName, b.patientName],
          message: `${a.patientName} and ${b.patientName} have overlapping fixed windows. Only one can be served on time.`,
        });
      }
    }
  }

  return warnings;
};

type LunchContext = {
  targetLunchStartSeconds: number;
  lunchDurationSeconds: number;
};

type FlexibleSegmentRange = {
  startIndex: number;
  endIndex: number;
};

type ScheduleEvaluation = {
  score: ProjectionScore;
  penalty: number;
  dayOverflowSeconds: number;
  endTimeSeconds: number;
  lunchSkippedDueToFixed: boolean;
  maxIdleGapSeconds: number;
  distanceIdlePenaltySeconds: number;
  fixedAfterFlexibleCount: number;
  // Total seconds by which fixed-window visits were served after their window
  // opened. Zero means every fixed patient was served exactly at window open
  // (or that the nurse waited outside and entered at the window start). A higher
  // value means fixed patients were served later into their windows, reducing
  // the buffer against delays. Used as a hard guard: moves that push fixed
  // patients later inside their windows are rejected even when no lateness occurs.
  fixedSlackConsumedSeconds: number;
};

const orderVisitsByWindowDistanceAndDuration = (
  visits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  preserveOrder: boolean,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
) => {
  if (preserveOrder) {
    const orderedVisits: VisitWithCoords[] = [];
    const unscheduledTasks: UnscheduledTaskV2[] = [];
    let currentLocation = startLocation;
    let currentTimeSeconds = departureLocalSeconds;

    for (const visit of visits) {
      const projection = projectVisit(
        visit,
        currentLocation,
        currentTimeSeconds,
        resolveTravelSeconds,
      );
      if (
        visit.windowType === "flexible" &&
        projection.serviceEndSeconds > PLANNING_DAY_END_SECONDS
      ) {
        unscheduledTasks.push({
          visitId: visit.visitId,
          patientId: visit.patientId,
          reason: "insufficient_day_capacity",
        });
      } else {
        orderedVisits.push(visit);
        currentLocation = { coords: visit.coords, locationKey: visit.locationKey };
        currentTimeSeconds = projection.serviceEndSeconds;
      }
    }

    return { orderedVisits, unscheduledTasks };
  }

  const remaining = [...visits];
  const ordered: VisitWithCoords[] = [];
  const unscheduledTasks: UnscheduledTaskV2[] = [];
  let currentLocation = startLocation;
  let currentTimeSeconds = departureLocalSeconds;
  let lunchTaken = false;
  let lunchSkippedDueToFixed = false;
  // Gap window planning: pre-planned visit sequence for the idle gap before a
  // fixed anchor. Populated once per anchor; drained visit-by-visit each iteration.
  let gapQueue: VisitWithCoords[] = [];
  let gapQueueAnchorId: string | null = null;

  while (remaining.length > 0) {
    // Lunch break logic: insert a time-block at the target lunch window when feasible
    if (lunchContext && !lunchTaken && currentTimeSeconds >= lunchContext.targetLunchStartSeconds) {
      const lunchEndSeconds =
        lunchContext.targetLunchStartSeconds + lunchContext.lunchDurationSeconds;
      const hasFixedConflict = remaining.some(
        (v) =>
          v.windowType === "fixed" &&
          v.windowStartSeconds < lunchEndSeconds &&
          v.windowEndSeconds > lunchContext.targetLunchStartSeconds,
      );
      if (!hasFixedConflict) {
        currentTimeSeconds =
          Math.max(currentTimeSeconds, lunchContext.targetLunchStartSeconds) +
          lunchContext.lunchDurationSeconds;
      } else {
        lunchSkippedDueToFixed = true;
      }
      lunchTaken = true;
    }

    const capacityBlockedFlexibleVisitIds = new Set(
      remaining
        .filter((visit) => visit.windowType === "flexible")
        .filter((visit) => {
          const projection = projectVisit(
            visit,
            currentLocation,
            currentTimeSeconds,
            resolveTravelSeconds,
          );
          return projection.serviceEndSeconds > PLANNING_DAY_END_SECONDS;
        })
        .map((visit) => visit.visitId),
    );

    if (capacityBlockedFlexibleVisitIds.size > 0) {
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const visit = remaining[index];
        if (!visit || !capacityBlockedFlexibleVisitIds.has(visit.visitId)) {
          continue;
        }

        remaining.splice(index, 1);
        unscheduledTasks.push({
          visitId: visit.visitId,
          patientId: visit.patientId,
          reason: "insufficient_day_capacity",
        });
      }

      if (remaining.length === 0) {
        break;
      }
    }

    const projections = remaining.map((visit) => {
      const projected = projectVisit(
        visit,
        currentLocation,
        currentTimeSeconds,
        resolveTravelSeconds,
      );
      const remainingAfter = remaining.filter((candidate) => candidate.visitId !== visit.visitId);
      const futureScore = evaluateFutureBestScore(
        remainingAfter,
        visit,
        projected.serviceEndSeconds,
        LOOKAHEAD_DEPTH - 1,
        resolveTravelSeconds,
        objective,
      );

      return {
        ...projected,
        score: addScores(scoreProjection(projected), futureScore),
      };
    });

    const hasFixedRemaining = projections.some((p) => p.visit.windowType === "fixed");
    const lateFixedProjections = hasFixedRemaining
      ? projections.filter((p) => p.visit.windowType === "fixed" && p.lateBySeconds > 0)
      : [];
    // Objective-specific fixed anchoring:
    // - time mode: avoid anchoring on far-future fixed visits unless they are late
    //   or near-due.
    // - distance mode: keep fixed-first for near-due fixed visits, but allow
    //   far-future fixed anchors to defer so we can avoid extreme idle blocks
    //   and downstream flexible lateness.
    const prioritizedFixedProjections =
      lateFixedProjections.length > 0
        ? []
        : objective === "distance"
          ? projections.filter(
              (p) =>
                p.visit.windowType === "fixed" &&
                p.waitSeconds <= DISTANCE_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS,
            )
          : projections.filter(
              (p) =>
                p.visit.windowType === "fixed" &&
                p.waitSeconds <= TIME_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS,
            );
    const shouldPrioritizeFixed =
      lateFixedProjections.length > 0 || prioritizedFixedProjections.length > 0;

    const isFlexibleWindowed = (p: (typeof projections)[number]) =>
      p.visit.windowType !== "fixed" && p.visit.hasPreferredWindow;
    const lateFlexibleProjections = !shouldPrioritizeFixed
      ? projections.filter((p) => isFlexibleWindowed(p) && p.lateBySeconds > 0)
      : [];
    const urgentFlexibleProjections =
      !shouldPrioritizeFixed && lateFlexibleProjections.length === 0
        ? projections.filter(
            (p) =>
              isFlexibleWindowed(p) &&
              p.slackSeconds >= 0 &&
              p.slackSeconds < FLEXIBLE_URGENCY_THRESHOLD_SECONDS,
          )
        : [];
    // Patients with a real preferred window but not yet urgent are anchored above
    // unconstrained (no-window) patients. The gap-filler mechanism then fills idle
    // time before the window opens with nearby no-window patients, preventing the
    // common failure mode where greedy travel-time picks consume the entire day and
    // the windowed patient's deadline is missed.
    const windowedFlexibleProjections =
      !shouldPrioritizeFixed &&
      lateFlexibleProjections.length === 0 &&
      urgentFlexibleProjections.length === 0
        ? projections.filter((p) => isFlexibleWindowed(p))
        : [];
    const primaryProjections =
      lateFixedProjections.length > 0
        ? lateFixedProjections
        : prioritizedFixedProjections.length > 0
          ? prioritizedFixedProjections
          : lateFlexibleProjections.length > 0
            ? lateFlexibleProjections
            : urgentFlexibleProjections.length > 0
              ? urgentFlexibleProjections
              : windowedFlexibleProjections.length > 0
                ? windowedFlexibleProjections
                : projections;
    if (primaryProjections === urgentFlexibleProjections) {
      primaryProjections.sort((a, b) =>
        a.slackSeconds !== b.slackSeconds
          ? a.slackSeconds - b.slackSeconds
          : a.travelSeconds - b.travelSeconds,
      );
    } else {
      primaryProjections.sort((left, right) => compareVisitProjections(left, right, objective));
    }
    const firstProjection = primaryProjections[0];
    if (!firstProjection) {
      throw new HttpError(500, "Unable to evaluate route candidates.");
    }

    // Gap window planning: when a large gap exists before an anchored visit,
    // plan the full sequence of gap visits once rather than picking one at a time.
    // This prevents visits with wide windows (e.g. Dindyal 08:30-13:00) from
    // being stranded after the anchor because a greedy one-at-a-time picker
    // chose geometrically closer visits on each individual iteration.
    const allowGapPlanningForAnchor =
      objective !== "distance" ||
      firstProjection.visit.windowType !== "fixed" ||
      firstProjection.waitSeconds > DISTANCE_FIXED_PRIORITY_WAIT_THRESHOLD_SECONDS;
    const isGapPlanningEligible =
      allowGapPlanningForAnchor &&
      firstProjection.waitSeconds >= IDLE_GAP_FILL_THRESHOLD_SECONDS &&
      firstProjection.visit.visitId !== gapQueueAnchorId &&
      (hasFixedRemaining || firstProjection.visit.hasPreferredWindow);

    if (isGapPlanningEligible) {
      gapQueueAnchorId = firstProjection.visit.visitId;
      gapQueue = planGapWindowSequence(
        firstProjection.visit,
        projections,
        currentTimeSeconds,
        currentLocation,
        resolveTravelSeconds,
      );
    }

    // Drain pre-planned gap sequence when available; skip stale entries (visits
    // removed from remaining by capacity checks or previous unscheduling).
    let selected: VisitProjection | undefined;
    while (gapQueue.length > 0) {
      const queued = gapQueue[0];
      if (queued && remaining.some((v) => v.visitId === queued.visitId)) {
        selected = projections.find((p) => p.visit.visitId === queued.visitId);
        gapQueue.shift();
        break;
      }
      gapQueue.shift();
    }

    // Fall back to single-pick gap-filler / regular selection if queue is empty
    if (!selected) {
      selected = maybeSelectGapFiller(
        firstProjection,
        projections,
        currentTimeSeconds,
        resolveTravelSeconds,
        objective,
      );
    }

    if (!selected) {
      throw new HttpError(500, "Unable to select next visit.");
    }

    const selectedIndex = remaining.findIndex((visit) => visit.visitId === selected.visit.visitId);
    if (selectedIndex < 0) {
      throw new HttpError(500, "Unable to resolve selected visit.");
    }

    const [nextVisit] = remaining.splice(selectedIndex, 1);
    if (!nextVisit) {
      throw new HttpError(500, "Unable to resolve selected visit entry.");
    }

    ordered.push(nextVisit);
    currentLocation = {
      coords: nextVisit.coords,
      locationKey: nextVisit.locationKey,
    };
    currentTimeSeconds = selected.serviceEndSeconds;
  }

  return {
    orderedVisits: ordered,
    unscheduledTasks,
    lunchSkippedDueToFixed,
  };
};

const buildPenalty = (
  evaluation: Omit<ScheduleEvaluation, "penalty">,
  objective: "time" | "distance",
) => {
  const distanceIdlePenaltySeconds =
    objective === "distance" ? evaluation.distanceIdlePenaltySeconds : 0;
  const objectiveSeconds =
    objective === "time"
      ? evaluation.score.totalWaitSeconds + evaluation.score.totalTravelSeconds
      : evaluation.score.totalTravelSeconds * PLANNING_DAY_END_SECONDS +
        evaluation.score.totalWaitSeconds +
        distanceIdlePenaltySeconds;

  return (
    evaluation.score.fixedLateCount * 1_000_000_000_000 +
    evaluation.score.fixedLateSeconds * 1_000_000_000 +
    evaluation.score.totalLateSeconds * 1_000_000 +
    evaluation.dayOverflowSeconds * 1_000 +
    objectiveSeconds
  );
};

const evaluateOrderedVisits = (
  orderedVisits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
): ScheduleEvaluation => {
  let currentLocation = startLocation;
  let currentTimeSeconds = departureLocalSeconds;
  let lunchTaken = false;
  let lunchSkippedDueToFixed = false;
  let score = ZERO_SCORE;
  let maxIdleGapSeconds = 0;
  let fixedAfterFlexibleCount = 0;
  let fixedSlackConsumedSeconds = 0;
  let seenFlexibleVisit = false;

  orderedVisits.forEach((visit, index) => {
    if (lunchContext && !lunchTaken && currentTimeSeconds >= lunchContext.targetLunchStartSeconds) {
      const lunchEndSeconds =
        lunchContext.targetLunchStartSeconds + lunchContext.lunchDurationSeconds;
      const remainingVisits = orderedVisits.slice(index);
      const hasFixedConflict = remainingVisits.some(
        (candidate) =>
          candidate.windowType === "fixed" &&
          candidate.windowStartSeconds < lunchEndSeconds &&
          candidate.windowEndSeconds > lunchContext.targetLunchStartSeconds,
      );

      if (!hasFixedConflict) {
        currentTimeSeconds =
          Math.max(currentTimeSeconds, lunchContext.targetLunchStartSeconds) +
          lunchContext.lunchDurationSeconds;
      } else {
        lunchSkippedDueToFixed = true;
      }
      lunchTaken = true;
    }

    const projection = projectVisit(
      visit,
      currentLocation,
      currentTimeSeconds,
      resolveTravelSeconds,
    );
    maxIdleGapSeconds = Math.max(maxIdleGapSeconds, projection.waitSeconds);
    score = addScores(score, scoreProjection(projection));

    if (visit.windowType === "fixed") {
      if (seenFlexibleVisit) {
        fixedAfterFlexibleCount += 1;
      }
    } else {
      seenFlexibleVisit = true;
    }

    // Accumulate how far into their window each fixed patient was actually
    // served. If the nurse arrives early and waits at the door, serviceStart
    // equals windowStart and this contributes 0. If the nurse arrives late
    // (within the window), this grows. Used as a secondary hard guard.
    if (visit.windowType === "fixed" && visit.hasPreferredWindow) {
      fixedSlackConsumedSeconds += Math.max(
        0,
        projection.serviceStartSeconds - visit.windowStartSeconds,
      );
    }

    currentLocation = {
      coords: visit.coords,
      locationKey: visit.locationKey,
    };
    currentTimeSeconds = projection.serviceEndSeconds;
  });

  const distanceIdlePenaltySeconds =
    objective === "distance"
      ? Math.max(0, maxIdleGapSeconds - DISTANCE_IDLE_GAP_THRESHOLD_SECONDS) *
        DISTANCE_IDLE_PENALTY_MULTIPLIER
      : 0;

  const baseEvaluation = {
    score,
    dayOverflowSeconds: Math.max(0, currentTimeSeconds - PLANNING_DAY_END_SECONDS),
    endTimeSeconds: currentTimeSeconds,
    lunchSkippedDueToFixed,
    maxIdleGapSeconds,
    distanceIdlePenaltySeconds,
    fixedAfterFlexibleCount,
    fixedSlackConsumedSeconds,
  };

  return {
    ...baseEvaluation,
    penalty: buildPenalty(baseEvaluation, objective),
  };
};

const doesNotWorsenDelayedDepartureConstraints = (
  candidate: ScheduleEvaluation,
  baseline: ScheduleEvaluation,
) => {
  const fixedLatenessComparison = compareFixedLateness(candidate.score, baseline.score);
  if (fixedLatenessComparison !== 0) {
    return fixedLatenessComparison < 0;
  }

  if (candidate.score.totalLateSeconds !== baseline.score.totalLateSeconds) {
    return candidate.score.totalLateSeconds < baseline.score.totalLateSeconds;
  }

  if (candidate.dayOverflowSeconds !== baseline.dayOverflowSeconds) {
    return candidate.dayOverflowSeconds < baseline.dayOverflowSeconds;
  }

  if (candidate.lunchSkippedDueToFixed !== baseline.lunchSkippedDueToFixed) {
    return baseline.lunchSkippedDueToFixed || !candidate.lunchSkippedDueToFixed;
  }

  return true;
};

const resolveLatestFeasibleDepartureLocalSeconds = (
  orderedVisits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  workStartSeconds: number | undefined,
) => {
  if (orderedVisits.length === 0) {
    return departureLocalSeconds;
  }

  if (!orderedVisits.some((visit) => visit.hasPreferredWindow)) {
    return departureLocalSeconds;
  }

  const hasEarlyFixedVisit =
    orderedVisits[0]?.windowType === "fixed" ||
    (workStartSeconds !== undefined &&
      orderedVisits.some(
        (visit) => visit.windowType === "fixed" && visit.windowStartSeconds <= workStartSeconds,
      ));
  if (hasEarlyFixedVisit) {
    return departureLocalSeconds;
  }

  const baseline = evaluateOrderedVisits(
    orderedVisits,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
  );

  let low = departureLocalSeconds;
  let high = PLANNING_DAY_END_SECONDS;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const candidate = evaluateOrderedVisits(
      orderedVisits,
      startLocation,
      mid,
      resolveTravelSeconds,
      lunchContext,
      objective,
    );

    if (doesNotWorsenDelayedDepartureConstraints(candidate, baseline)) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
};

const compareScheduleEvaluations = (
  left: ScheduleEvaluation,
  right: ScheduleEvaluation,
  objective: "time" | "distance",
) => {
  const fixedLatenessComparison = compareFixedLateness(left.score, right.score);
  if (fixedLatenessComparison !== 0) {
    return fixedLatenessComparison;
  }

  if (left.score.totalLateSeconds !== right.score.totalLateSeconds) {
    return left.score.totalLateSeconds - right.score.totalLateSeconds;
  }

  if (objective === "time") {
    const leftElapsed = left.score.totalWaitSeconds + left.score.totalTravelSeconds;
    const rightElapsed = right.score.totalWaitSeconds + right.score.totalTravelSeconds;
    const elapsedDifference = leftElapsed - rightElapsed;

    if (Math.abs(elapsedDifference) > TIME_IDLE_ELAPSED_TOLERANCE_SECONDS) {
      return elapsedDifference;
    }

    const leftIdleExcess = Math.max(0, left.maxIdleGapSeconds - TIME_IDLE_GAP_THRESHOLD_SECONDS);
    const rightIdleExcess = Math.max(0, right.maxIdleGapSeconds - TIME_IDLE_GAP_THRESHOLD_SECONDS);
    if (leftIdleExcess !== rightIdleExcess) {
      return leftIdleExcess - rightIdleExcess;
    }

    if (elapsedDifference !== 0) {
      return elapsedDifference;
    }
  }

  if (objective === "distance") {
    const hasLargeIdleGap =
      left.maxIdleGapSeconds > DISTANCE_IDLE_GAP_THRESHOLD_SECONDS ||
      right.maxIdleGapSeconds > DISTANCE_IDLE_GAP_THRESHOLD_SECONDS;
    if (!hasLargeIdleGap && left.fixedAfterFlexibleCount !== right.fixedAfterFlexibleCount) {
      return left.fixedAfterFlexibleCount - right.fixedAfterFlexibleCount;
    }

    const travelDifference = left.score.totalTravelSeconds - right.score.totalTravelSeconds;
    if (Math.abs(travelDifference) > DISTANCE_IDLE_TRAVEL_TOLERANCE_SECONDS) {
      return travelDifference;
    }

    const leftDistanceObjective =
      left.score.totalTravelSeconds + left.score.totalWaitSeconds + left.distanceIdlePenaltySeconds;
    const rightDistanceObjective =
      right.score.totalTravelSeconds +
      right.score.totalWaitSeconds +
      right.distanceIdlePenaltySeconds;
    if (leftDistanceObjective !== rightDistanceObjective) {
      return leftDistanceObjective - rightDistanceObjective;
    }

    if (travelDifference !== 0) {
      return travelDifference;
    }

    if (left.score.totalWaitSeconds !== right.score.totalWaitSeconds) {
      return left.score.totalWaitSeconds - right.score.totalWaitSeconds;
    }
  }

  if (left.dayOverflowSeconds !== right.dayOverflowSeconds) {
    return left.dayOverflowSeconds - right.dayOverflowSeconds;
  }

  if (left.lunchSkippedDueToFixed !== right.lunchSkippedDueToFixed) {
    return left.lunchSkippedDueToFixed ? 1 : -1;
  }

  if (left.endTimeSeconds !== right.endTimeSeconds) {
    return left.endTimeSeconds - right.endTimeSeconds;
  }

  return left.penalty - right.penalty;
};

const buildFlexibleSegmentRanges = (orderedVisits: VisitWithCoords[]): FlexibleSegmentRange[] => {
  const ranges: FlexibleSegmentRange[] = [];
  let segmentStart: number | null = null;

  orderedVisits.forEach((visit, index) => {
    if (visit.windowType !== "fixed") {
      if (segmentStart === null) {
        segmentStart = index;
      }
      return;
    }

    if (segmentStart !== null && index - segmentStart >= 2) {
      ranges.push({ startIndex: segmentStart, endIndex: index - 1 });
    }
    segmentStart = null;
  });

  if (segmentStart !== null && orderedVisits.length - segmentStart >= 2) {
    ranges.push({ startIndex: segmentStart, endIndex: orderedVisits.length - 1 });
  }

  return ranges;
};

const replaceRange = (
  orderedVisits: VisitWithCoords[],
  range: FlexibleSegmentRange,
  replacement: VisitWithCoords[],
) => [
  ...orderedVisits.slice(0, range.startIndex),
  ...replacement,
  ...orderedVisits.slice(range.endIndex + 1),
];

const reverseSegmentWindow = (
  orderedVisits: VisitWithCoords[],
  range: FlexibleSegmentRange,
  startOffset: number,
  endOffset: number,
) => {
  const segment = orderedVisits.slice(range.startIndex, range.endIndex + 1);
  const replacement = [
    ...segment.slice(0, startOffset),
    ...segment.slice(startOffset, endOffset + 1).reverse(),
    ...segment.slice(endOffset + 1),
  ];

  return replaceRange(orderedVisits, range, replacement);
};

const relocateSegmentWindow = (
  orderedVisits: VisitWithCoords[],
  range: FlexibleSegmentRange,
  fromOffset: number,
  moveLength: number,
  insertOffset: number,
) => {
  const segment = orderedVisits.slice(range.startIndex, range.endIndex + 1);
  const moving = segment.slice(fromOffset, fromOffset + moveLength);
  const remaining = [...segment.slice(0, fromOffset), ...segment.slice(fromOffset + moveLength)];

  const normalizedInsertOffset = Math.max(0, Math.min(insertOffset, remaining.length));
  const replacement = [
    ...remaining.slice(0, normalizedInsertOffset),
    ...moving,
    ...remaining.slice(normalizedInsertOffset),
  ];

  return replaceRange(orderedVisits, range, replacement);
};

const relocateFlexibleVisitGlobally = (
  orderedVisits: VisitWithCoords[],
  fromIndex: number,
  moveLength: number,
  targetIndex: number,
) => {
  const movingVisits = orderedVisits.slice(fromIndex, fromIndex + moveLength);
  if (movingVisits.length === 0) {
    return orderedVisits;
  }

  const remaining = [
    ...orderedVisits.slice(0, fromIndex),
    ...orderedVisits.slice(fromIndex + moveLength),
  ];
  const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, remaining.length));

  return [
    ...remaining.slice(0, normalizedTargetIndex),
    ...movingVisits,
    ...remaining.slice(normalizedTargetIndex),
  ];
};

const isGloballyMovableFlexibleBlock = (
  orderedVisits: VisitWithCoords[],
  fromIndex: number,
  moveLength: number,
) => {
  const movingVisits = orderedVisits.slice(fromIndex, fromIndex + moveLength);
  // Any block composed entirely of non-fixed visits is movable. No-window
  // flexible visits are included — relocating them can free time for fixed
  // windows and should not be artificially gated by neighbour type.
  return movingVisits.length > 0 && movingVisits.every((visit) => visit.windowType !== "fixed");
};

// Returns true when the candidate strictly worsens any fixed-window constraint
// relative to the reference. Used as a hard guard in the ILS local search: no
// move that hurts fixed patients is ever accepted regardless of travel savings.
//
// Three-tier check (in order):
//  1. fixedLateCount   — any new missed fixed window is an immediate reject.
//  2. fixedLateSeconds — more cumulative lateness for already-missed windows.
//  3. fixedSlackConsumedSeconds — fixed patients served later *inside* their
//     window. This catches the case where Jing (no-window flexible, very close)
//     gets inserted before Ravi (fixed 09:00–10:00, farther away): Ravi stays
//     within its window but is served 20 min later, burning slack and leaving
//     less buffer against real-world delays.
const worsensFixedLateness = (candidate: ScheduleEvaluation, reference: ScheduleEvaluation) => {
  if (candidate.score.fixedLateCount !== reference.score.fixedLateCount) {
    return candidate.score.fixedLateCount > reference.score.fixedLateCount;
  }
  if (candidate.score.fixedLateSeconds !== reference.score.fixedLateSeconds) {
    return candidate.score.fixedLateSeconds > reference.score.fixedLateSeconds;
  }
  return candidate.fixedSlackConsumedSeconds > reference.fixedSlackConsumedSeconds;
};

const isAcceptedImprovement = (
  candidate: ScheduleEvaluation,
  reference: ScheduleEvaluation,
  objective: "time" | "distance",
) => {
  // Uniform safety contract across all acceptance paths:
  // 1) fixedLateCount must not increase
  // 2) fixedLateSeconds must not increase (when counts tie)
  // 3) fixedSlackConsumedSeconds must not increase (when fixed lateness ties)
  if (worsensFixedLateness(candidate, reference)) {
    return false;
  }

  return compareScheduleEvaluations(candidate, reference, objective) < 0;
};

const localSearchSweep = (
  orderedVisits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  deadlineMs: number,
) => {
  let bestOrder = orderedVisits;
  let bestEvaluation = evaluateOrderedVisits(
    bestOrder,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
  );
  let improved = true;

  while (improved && Date.now() < deadlineMs) {
    improved = false;

    // Best-improvement: scan the full neighbourhood in one pass and apply the
    // single best move found. This is more informative per unit of clock time
    // than first-improvement-with-restart, which re-scans from index 0 after
    // every accepted move and exhausts the time budget on early iterations.
    let bestCandidateOrder: VisitWithCoords[] | null = null;
    let bestCandidateEvaluation: ScheduleEvaluation | null = null;

    const acceptCandidate = (
      candidateOrder: VisitWithCoords[],
      candidateEvaluation: ScheduleEvaluation,
    ) => {
      const reference = bestCandidateEvaluation ?? bestEvaluation;
      if (isAcceptedImprovement(candidateEvaluation, reference, objective)) {
        bestCandidateOrder = candidateOrder;
        bestCandidateEvaluation = candidateEvaluation;
      }
    };

    // Phase 1 — global relocation moves (1-3 consecutive flexible visits)
    for (let moveLength = 1; moveLength <= 3; moveLength += 1) {
      for (let fromIndex = 0; fromIndex + moveLength <= bestOrder.length; fromIndex += 1) {
        if (!isGloballyMovableFlexibleBlock(bestOrder, fromIndex, moveLength)) {
          continue;
        }

        for (let targetIndex = 0; targetIndex <= bestOrder.length - moveLength; targetIndex += 1) {
          if (targetIndex === fromIndex) {
            continue;
          }

          if (Date.now() >= deadlineMs) {
            if (bestCandidateOrder) {
              return { orderedVisits: bestCandidateOrder, evaluation: bestCandidateEvaluation! };
            }
            return { orderedVisits: bestOrder, evaluation: bestEvaluation };
          }

          const candidateOrder = relocateFlexibleVisitGlobally(
            bestOrder,
            fromIndex,
            moveLength,
            targetIndex,
          );
          acceptCandidate(
            candidateOrder,
            evaluateOrderedVisits(
              candidateOrder,
              startLocation,
              departureLocalSeconds,
              resolveTravelSeconds,
              lunchContext,
              objective,
            ),
          );
        }
      }
    }

    // Phase 2 — segment-scoped moves (reverse + relocate within flexible segments)
    const segments = buildFlexibleSegmentRanges(bestOrder);
    for (const segment of segments) {
      const segmentLength = segment.endIndex - segment.startIndex + 1;

      // 2-opt reversals within the segment
      for (let startOffset = 0; startOffset < segmentLength - 1; startOffset += 1) {
        for (let endOffset = startOffset + 1; endOffset < segmentLength; endOffset += 1) {
          if (Date.now() >= deadlineMs) {
            if (bestCandidateOrder) {
              return { orderedVisits: bestCandidateOrder, evaluation: bestCandidateEvaluation! };
            }
            return { orderedVisits: bestOrder, evaluation: bestEvaluation };
          }

          const candidateOrder = reverseSegmentWindow(bestOrder, segment, startOffset, endOffset);
          acceptCandidate(
            candidateOrder,
            evaluateOrderedVisits(
              candidateOrder,
              startLocation,
              departureLocalSeconds,
              resolveTravelSeconds,
              lunchContext,
              objective,
            ),
          );
        }
      }

      // Relocations within the segment
      for (let moveLength = 1; moveLength <= Math.min(3, segmentLength - 1); moveLength += 1) {
        for (let fromOffset = 0; fromOffset + moveLength <= segmentLength; fromOffset += 1) {
          for (
            let insertOffset = 0;
            insertOffset <= segmentLength - moveLength;
            insertOffset += 1
          ) {
            if (insertOffset === fromOffset) {
              continue;
            }

            if (Date.now() >= deadlineMs) {
              if (bestCandidateOrder) {
                return { orderedVisits: bestCandidateOrder, evaluation: bestCandidateEvaluation! };
              }
              return { orderedVisits: bestOrder, evaluation: bestEvaluation };
            }

            const candidateOrder = relocateSegmentWindow(
              bestOrder,
              segment,
              fromOffset,
              moveLength,
              insertOffset,
            );
            acceptCandidate(
              candidateOrder,
              evaluateOrderedVisits(
                candidateOrder,
                startLocation,
                departureLocalSeconds,
                resolveTravelSeconds,
                lunchContext,
                objective,
              ),
            );
          }
        }
      }
    }

    // Apply the single best move found across the entire neighbourhood
    if (bestCandidateOrder) {
      bestOrder = bestCandidateOrder;
      bestEvaluation = bestCandidateEvaluation!;
      improved = true;
    }
  }

  return { orderedVisits: bestOrder, evaluation: bestEvaluation };
};

const perturbFlexibleSegment = (
  orderedVisits: VisitWithCoords[],
  segments: FlexibleSegmentRange[],
  rng: RandomSource,
) => {
  const eligibleSegments = segments.filter(
    (segment) => segment.endIndex - segment.startIndex + 1 >= 2,
  );
  if (eligibleSegments.length === 0) {
    return orderedVisits;
  }

  // Pick a random eligible segment rather than cycling deterministically — this
  // ensures successive perturbations explore different parts of the solution.
  const segment = eligibleSegments[Math.floor(rng() * eligibleSegments.length)];
  if (!segment) {
    return orderedVisits;
  }

  const segmentVisits = orderedVisits.slice(segment.startIndex, segment.endIndex + 1);
  if (segmentVisits.length >= 4) {
    // Pick a random split point and reverse a sub-range for diversification.
    const splitStart = Math.floor(rng() * (segmentVisits.length - 1));
    const splitEnd = splitStart + 1 + Math.floor(rng() * (segmentVisits.length - splitStart - 1));
    const replacement = [
      ...segmentVisits.slice(0, splitStart),
      ...segmentVisits.slice(splitStart, splitEnd + 1).reverse(),
      ...segmentVisits.slice(splitEnd + 1),
    ];
    return replaceRange(orderedVisits, segment, replacement);
  }

  // For short segments rotate by a random non-zero offset.
  const rotation = Math.floor(rng() * (segmentVisits.length - 1)) + 1;
  const replacement = [...segmentVisits.slice(rotation), ...segmentVisits.slice(0, rotation)];
  return replaceRange(orderedVisits, segment, replacement);
};

const perturbFlexibleBlockGlobally = (orderedVisits: VisitWithCoords[], rng: RandomSource) => {
  const candidates: Array<{ fromIndex: number; moveLength: number }> = [];

  for (let moveLength = 1; moveLength <= 3; moveLength += 1) {
    for (let fromIndex = 0; fromIndex + moveLength <= orderedVisits.length; fromIndex += 1) {
      if (!isGloballyMovableFlexibleBlock(orderedVisits, fromIndex, moveLength)) {
        continue;
      }

      candidates.push({ fromIndex, moveLength });
    }
  }

  if (candidates.length === 0) {
    return orderedVisits;
  }

  // Pick a random block and a random target position. The previous modular
  // formula re-visited the same (block, target) pairs on every run, so the
  // ILS never escaped the neighbourhood explored in iteration 0.
  const candidate = candidates[Math.floor(rng() * candidates.length)];
  if (!candidate) {
    return orderedVisits;
  }

  const remainingLength = orderedVisits.length - candidate.moveLength;
  if (remainingLength <= 0) {
    return orderedVisits;
  }

  let targetIndex = Math.floor(rng() * (remainingLength + 1));
  if (targetIndex === candidate.fromIndex) {
    targetIndex = (targetIndex + 1) % (remainingLength + 1);
  }

  return relocateFlexibleVisitGlobally(
    orderedVisits,
    candidate.fromIndex,
    candidate.moveLength,
    targetIndex,
  );
};

const refineTrailingFlexibleBlocksAheadOfFixed = (
  orderedVisits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  deadlineMs: number,
) => {
  let bestOrder = orderedVisits;
  let bestEvaluation = evaluateOrderedVisits(
    bestOrder,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
  );
  let improved = true;

  while (improved && Date.now() < deadlineMs) {
    improved = false;

    for (let fixedIndex = 0; fixedIndex < bestOrder.length - 1 && !improved; fixedIndex += 1) {
      if (Date.now() >= deadlineMs) {
        return { orderedVisits: bestOrder, evaluation: bestEvaluation };
      }

      if (bestOrder[fixedIndex]?.windowType !== "fixed") {
        continue;
      }

      for (
        let moveLength = 1;
        moveLength <= 2 && fixedIndex + moveLength < bestOrder.length;
        moveLength += 1
      ) {
        if (Date.now() >= deadlineMs) {
          return { orderedVisits: bestOrder, evaluation: bestEvaluation };
        }

        const fromIndex = fixedIndex + 1;
        if (!isGloballyMovableFlexibleBlock(bestOrder, fromIndex, moveLength)) {
          continue;
        }

        const candidateOrder = relocateFlexibleVisitGlobally(
          bestOrder,
          fromIndex,
          moveLength,
          fixedIndex,
        );
        const candidateEvaluation = evaluateOrderedVisits(
          candidateOrder,
          startLocation,
          departureLocalSeconds,
          resolveTravelSeconds,
          lunchContext,
          objective,
        );

        if (isAcceptedImprovement(candidateEvaluation, bestEvaluation, objective)) {
          bestOrder = candidateOrder;
          bestEvaluation = candidateEvaluation;
          improved = true;
          break;
        }
      }
    }
  }

  return { orderedVisits: bestOrder, evaluation: bestEvaluation };
};

const promoteNoWindowBeforeLateFixedAnchors = (
  orderedVisits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  deadlineMs: number,
) => {
  let bestOrder = orderedVisits;
  let bestEvaluation = evaluateOrderedVisits(
    bestOrder,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
  );
  let improved = true;

  while (improved && Date.now() < deadlineMs) {
    improved = false;

    for (let fixedIndex = 0; fixedIndex < bestOrder.length - 1; fixedIndex += 1) {
      if (Date.now() >= deadlineMs) {
        return { orderedVisits: bestOrder, evaluation: bestEvaluation };
      }

      const fixedVisit = bestOrder[fixedIndex];
      const trailingVisit = bestOrder[fixedIndex + 1];

      if (
        !fixedVisit ||
        !trailingVisit ||
        fixedVisit.windowType !== "fixed" ||
        trailingVisit.windowType !== "flexible" ||
        trailingVisit.hasPreferredWindow
      ) {
        continue;
      }

      const candidateOrder = relocateFlexibleVisitGlobally(
        bestOrder,
        fixedIndex + 1,
        1,
        fixedIndex,
      );
      const candidateEvaluation = evaluateOrderedVisits(
        candidateOrder,
        startLocation,
        departureLocalSeconds,
        resolveTravelSeconds,
        lunchContext,
        objective,
      );

      if (isAcceptedImprovement(candidateEvaluation, bestEvaluation, objective)) {
        bestOrder = candidateOrder;
        bestEvaluation = candidateEvaluation;
        improved = true;
        break;
      }
    }
  }

  return { orderedVisits: bestOrder, evaluation: bestEvaluation };
};

const solveRouteWithIls = (
  visits: VisitWithCoords[],
  startLocation: LocationRef,
  departureLocalSeconds: number,
  resolveTravelSeconds: (from: LocationRef, to: LocationRef) => number,
  preserveOrder: boolean,
  lunchContext: LunchContext | undefined,
  objective: "time" | "distance",
  rng: RandomSource,
  shadowContext?: OptimizeRouteV3ShadowContext,
) => {
  const seed = orderVisitsByWindowDistanceAndDuration(
    visits,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    preserveOrder,
    lunchContext,
    objective,
  );

  const seedEvaluation = evaluateOrderedVisits(
    seed.orderedVisits,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
  );

  if (
    preserveOrder ||
    seed.orderedVisits.length < 2 ||
    !seed.orderedVisits.some((visit) => visit.windowType !== "fixed")
  ) {
    return {
      ...seed,
      lunchSkippedDueToFixed: seedEvaluation.lunchSkippedDueToFixed,
      diagnostics: {
        penalty: seedEvaluation.penalty,
        fixedLateCount: seedEvaluation.score.fixedLateCount,
        fixedLateSeconds: seedEvaluation.score.fixedLateSeconds,
        totalLateSeconds: seedEvaluation.score.totalLateSeconds,
        totalWaitSeconds: seedEvaluation.score.totalWaitSeconds,
        totalTravelSeconds: seedEvaluation.score.totalTravelSeconds,
      },
    };
  }

  let bestOrder = seed.orderedVisits;
  let bestEvaluation = seedEvaluation;
  // currentOrder is the ILS incumbent — the solution perturbations are applied
  // to. It always advances to the local optimum of each iteration regardless of
  // whether that optimum beats the global best. This is the standard ILS
  // acceptance rule and ensures the search escapes local optima rather than
  // repeatedly perturbing the same global-best solution.
  let currentOrder = seed.orderedVisits;
  const deadlineMs = Date.now() + ILS_TIME_LIMIT_MS;

  for (
    let iteration = 0;
    iteration < MAX_ILS_ITERATIONS && Date.now() < deadlineMs;
    iteration += 1
  ) {
    const segments = buildFlexibleSegmentRanges(currentOrder);
    const candidateStart =
      iteration === 0
        ? currentOrder
        : iteration % 2 === 0
          ? perturbFlexibleSegment(currentOrder, segments, rng)
          : perturbFlexibleBlockGlobally(currentOrder, rng);
    const localResult = localSearchSweep(
      candidateStart,
      startLocation,
      departureLocalSeconds,
      resolveTravelSeconds,
      lunchContext,
      objective,
      deadlineMs,
    );

    // Always advance the incumbent to the new local optimum (ILS acceptance).
    // This incumbent can drift on fixed-window slack consumption across iterations;
    // that is intentional to preserve exploration diversity. Output safety comes
    // from the guarded global-best acceptance below.
    currentOrder = localResult.orderedVisits;

    // Update the global best only when the new local optimum is strictly better.
    if (isAcceptedImprovement(localResult.evaluation, bestEvaluation, objective)) {
      bestOrder = localResult.orderedVisits;
      bestEvaluation = localResult.evaluation;
    }
  }

  const refinedResult = refineTrailingFlexibleBlocksAheadOfFixed(
    bestOrder,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
    deadlineMs,
  );
  if (isAcceptedImprovement(refinedResult.evaluation, bestEvaluation, objective)) {
    bestOrder = refinedResult.orderedVisits;
    bestEvaluation = refinedResult.evaluation;
  }

  const promotedNoWindowResult = promoteNoWindowBeforeLateFixedAnchors(
    bestOrder,
    startLocation,
    departureLocalSeconds,
    resolveTravelSeconds,
    lunchContext,
    objective,
    deadlineMs,
  );
  if (isAcceptedImprovement(promotedNoWindowResult.evaluation, bestEvaluation, objective)) {
    bestOrder = promotedNoWindowResult.orderedVisits;
    bestEvaluation = promotedNoWindowResult.evaluation;
  }

  if (shadowContext?.shadowCompare) {
    const comparison = compareScheduleEvaluations(bestEvaluation, seedEvaluation, objective);
    console.info("[optimize-route-v3-shadow]", {
      requestId: shadowContext.requestId,
      nurseId: shadowContext.nurseId,
      status: comparison < 0 ? "improved" : comparison > 0 ? "worse" : "matched",
      objective,
      visitCount: visits.length,
      fixedVisitCount: visits.filter((visit) => visit.windowType === "fixed").length,
      windowedFlexibleVisitCount: visits.filter(
        (visit) => visit.windowType === "flexible" && visit.hasPreferredWindow,
      ).length,
      openFlexibleVisitCount: visits.filter(
        (visit) => visit.windowType === "flexible" && !visit.hasPreferredWindow,
      ).length,
      preserveOrder,
      seedPenalty: seedEvaluation.penalty,
      ilsPenalty: bestEvaluation.penalty,
      penaltyDelta: bestEvaluation.penalty - seedEvaluation.penalty,
      seedFixedLateCount: seedEvaluation.score.fixedLateCount,
      ilsFixedLateCount: bestEvaluation.score.fixedLateCount,
      seedTotalLateSeconds: seedEvaluation.score.totalLateSeconds,
      ilsTotalLateSeconds: bestEvaluation.score.totalLateSeconds,
      seedTravelSeconds: seedEvaluation.score.totalTravelSeconds,
      ilsTravelSeconds: bestEvaluation.score.totalTravelSeconds,
    });
  }

  return {
    orderedVisits: bestOrder,
    unscheduledTasks: seed.unscheduledTasks,
    lunchSkippedDueToFixed: bestEvaluation.lunchSkippedDueToFixed,
    diagnostics: {
      penalty: bestEvaluation.penalty,
      fixedLateCount: bestEvaluation.score.fixedLateCount,
      fixedLateSeconds: bestEvaluation.score.fixedLateSeconds,
      totalLateSeconds: bestEvaluation.score.totalLateSeconds,
      totalWaitSeconds: bestEvaluation.score.totalWaitSeconds,
      totalTravelSeconds: bestEvaluation.score.totalTravelSeconds,
    },
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
  const waitSeconds = task.hasPreferredWindow
    ? Math.max(0, task.windowStartSeconds - arrivalLocalSeconds)
    : 0;
  const serviceStartSeconds = arrivalLocalSeconds + waitSeconds;
  const serviceEndSeconds = serviceStartSeconds + task.serviceDurationMinutes * 60;
  const lateBySeconds = task.hasPreferredWindow
    ? computeMinuteAlignedLateBySeconds(serviceEndSeconds, task.windowEndSeconds)
    : 0;

  return {
    taskResult: {
      visitId: task.visitId,
      patientId: task.patientId,
      patientName: task.patientName,
      address: task.address,
      ...(task.googlePlaceId !== undefined ? { googlePlaceId: task.googlePlaceId } : {}),
      windowStart: task.hasPreferredWindow ? task.windowStart : "",
      windowEnd: task.hasPreferredWindow ? task.windowEnd : "",
      windowType: task.windowType,
      serviceDurationMinutes: task.serviceDurationMinutes,
      arrivalTime: toIsoFromLocalSeconds(
        arrivalLocalSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      ),
      serviceStartTime: toIsoFromLocalSeconds(
        serviceStartSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      ),
      serviceEndTime: toIsoFromLocalSeconds(
        serviceEndSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      ),
      waitSeconds,
      lateBySeconds,
      onTime: !task.hasPreferredWindow || lateBySeconds === 0,
    },
    serviceEndSeconds,
  };
};

const buildPlanningMatrixNodes = (
  startLocationKey: string,
  startCoords: LatLng,
  visits: VisitWithCoords[],
): TravelMatrixNode[] => {
  const nodesByKey = new Map<string, TravelMatrixNode>();

  nodesByKey.set(startLocationKey, {
    locationKey: startLocationKey,
    coords: startCoords,
  });

  visits.forEach((visit) => {
    if (!nodesByKey.has(visit.locationKey)) {
      nodesByKey.set(visit.locationKey, {
        locationKey: visit.locationKey,
        coords: visit.coords,
      });
    }
  });

  return [...nodesByKey.values()];
};

export const optimizeRouteV3 = async (
  request: ValidatedOptimizeRouteV2Request,
  googleMapsApiKey: string,
  shadowContext?: OptimizeRouteV3ShadowContext,
): Promise<OptimizeRouteResultV2> => {
  const objective = request.optimizationObjective ?? "distance";
  const coordsByLocationKey = await geocodeLocations(request, googleMapsApiKey);
  const startCoords = resolveCoordsOrThrow(coordsByLocationKey, request.start);
  const endCoords = resolveCoordsOrThrow(coordsByLocationKey, request.end);
  const startLocationKey = resolveLocationKey(request.start);

  const workingHoursStartSeconds = request.nurseWorkingHours
    ? parseTimeToSeconds(request.nurseWorkingHours.workStart)
    : undefined;
  const workingHoursEndSeconds = request.nurseWorkingHours
    ? parseTimeToSeconds(request.nurseWorkingHours.workEnd)
    : undefined;

  const visitsWithCoords: VisitWithCoords[] = request.visits.map((visit) => {
    const hasPreferredWindow =
      visit.windowStart.trim().length > 0 && visit.windowEnd.trim().length > 0;

    return {
      ...visit,
      coords: resolveCoordsOrThrow(coordsByLocationKey, visit),
      locationKey: resolveLocationKey(visit),
      hasPreferredWindow,
      windowStartSeconds: hasPreferredWindow
        ? parseTimeToSeconds(visit.windowStart)
        : (workingHoursStartSeconds ?? SYNTHETIC_WINDOW_START_SECONDS),
      windowEndSeconds: hasPreferredWindow
        ? parseTimeToSeconds(visit.windowEnd)
        : (workingHoursEndSeconds ?? SYNTHETIC_WINDOW_END_SECONDS),
    };
  });

  let planningTravelMatrix: TravelDurationMatrix | undefined;
  const matrixNodes = buildPlanningMatrixNodes(startLocationKey, startCoords, visitsWithCoords);

  if (matrixNodes.length <= MAX_MATRIX_NODES) {
    try {
      planningTravelMatrix = await buildPlanningTravelDurationMatrix(matrixNodes, googleMapsApiKey);
    } catch {
      planningTravelMatrix = undefined;
    }
  }

  const resolveTravelSeconds = buildTravelSecondsResolver(planningTravelMatrix);

  const fixedVisitsWithWindow = visitsWithCoords.filter(
    (visit) => visit.windowType === "fixed" && visit.hasPreferredWindow,
  );
  const conflictWarnings = detectWindowConflicts(fixedVisitsWithWindow, resolveTravelSeconds);

  const departureContext = await resolveDepartureContext(
    request,
    visitsWithCoords,
    {
      coords: startCoords,
      locationKey: startLocationKey,
    },
    googleMapsApiKey,
    planningTravelMatrix !== undefined,
    resolveTravelSeconds,
    objective,
  );
  let departureTimestampMs = departureContext.departureTimestampMs;
  let departureLocalSeconds = departureContext.departureLocalSeconds;
  let departureTime = departureContext.departureTime;

  let lunchContext: LunchContext | undefined;
  if (
    request.nurseWorkingHours?.lunchDurationMinutes &&
    workingHoursStartSeconds !== undefined &&
    workingHoursEndSeconds !== undefined
  ) {
    const lunchDurationSeconds = request.nurseWorkingHours.lunchDurationMinutes * 60;
    const targetLunchStartSeconds = request.nurseWorkingHours.lunchStartTime
      ? parseTimeToSeconds(request.nurseWorkingHours.lunchStartTime)
      : (workingHoursStartSeconds + workingHoursEndSeconds) / 2 - lunchDurationSeconds / 2;
    lunchContext = { targetLunchStartSeconds, lunchDurationSeconds };
  }

  const rngSeed = hashRequestIdToSeed(shadowContext?.requestId ?? "v3-default-seed");
  const rng = createSeededRng(rngSeed);

  const { orderedVisits, unscheduledTasks, lunchSkippedDueToFixed } = solveRouteWithIls(
    visitsWithCoords,
    {
      coords: startCoords,
      locationKey: startLocationKey,
    },
    departureLocalSeconds,
    resolveTravelSeconds,
    request.preserveOrder === true,
    lunchContext,
    objective,
    rng,
    shadowContext,
  );

  if (!request.start.departureTime) {
    const delayedDepartureLocalSeconds = resolveLatestFeasibleDepartureLocalSeconds(
      orderedVisits,
      {
        coords: startCoords,
        locationKey: startLocationKey,
      },
      departureLocalSeconds,
      resolveTravelSeconds,
      lunchContext,
      objective,
      workingHoursStartSeconds,
    );

    if (delayedDepartureLocalSeconds !== departureLocalSeconds) {
      departureLocalSeconds = delayedDepartureLocalSeconds;
      departureTime = toIsoFromPlanningDateAndLocalSeconds(
        request.planningDate,
        request.timezone,
        departureLocalSeconds,
      );
      departureTimestampMs = new Date(departureTime).getTime();
    }
  }

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
  let lunchAppliedInSchedule = false;

  const orderedStops = plannedStops.map((stop, index) => {
    // Apply the lunch gap before traveling to this stop if the nurse has passed the
    // target lunch time. This mirrors the ordering-phase logic so the gap appears in
    // the final ISO timestamps.
    if (
      lunchContext &&
      !lunchAppliedInSchedule &&
      !lunchSkippedDueToFixed &&
      cursorLocalSeconds >= lunchContext.targetLunchStartSeconds
    ) {
      cursorLocalSeconds =
        Math.max(cursorLocalSeconds, lunchContext.targetLunchStartSeconds) +
        lunchContext.lunchDurationSeconds;
      lunchAppliedInSchedule = true;
    }

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
      departureTime: toIsoFromLocalSeconds(
        cursorLocalSeconds,
        departureLocalSeconds,
        departureTimestampMs,
      ),
      tasks,
      distanceFromPreviousKm: drivingRoute.orderedStops[index]?.distanceFromPreviousKm ?? 0,
      durationFromPreviousSeconds:
        drivingRoute.orderedStops[index]?.durationFromPreviousSeconds ?? 0,
      ...(stop.isEndingPoint ? { isEndingPoint: true } : {}),
    };
  });

  const unscheduledFixedWindowViolations = unscheduledTasks.filter(
    (task) => task.reason === "fixed_window_unreachable",
  ).length;

  const lastTaskEndSeconds = (() => {
    for (let i = orderedStops.length - 1; i >= 0; i--) {
      const stop = orderedStops[i];
      if (!stop || stop.isEndingPoint) continue;
      const lastTask = stop.tasks[stop.tasks.length - 1];
      if (lastTask) {
        const endMs = new Date(lastTask.serviceEndTime).getTime();
        const depMs = departureTimestampMs;
        return departureLocalSeconds + (endMs - depMs) / 1000;
      }
    }
    return departureLocalSeconds;
  })();

  const warnings: ScheduleWarningV2[] = [...conflictWarnings];
  for (const stop of orderedStops) {
    for (const task of stop.tasks) {
      if (task.windowType === "fixed" && task.lateBySeconds > FIXED_LATE_TOLERANCE_SECONDS) {
        const lateMinutes = Math.ceil(task.lateBySeconds / 60);
        warnings.push({
          type: "fixed_late",
          patientId: task.patientId,
          patientName: task.patientName,
          message: `${task.patientName} has a fixed window and will be served ${lateMinutes} min late.`,
        });
      } else if (
        task.windowType === "flexible" &&
        task.windowStart &&
        task.windowEnd &&
        task.lateBySeconds > FLEXIBLE_LATE_TOLERANCE_SECONDS
      ) {
        const lateMinutes = Math.ceil(task.lateBySeconds / 60);
        warnings.push({
          type: "flexible_late",
          patientId: task.patientId,
          patientName: task.patientName,
          message: `${task.patientName} has a preferred window and will be served ${lateMinutes} min late.`,
        });
      }
    }
  }

  if (lunchSkippedDueToFixed && lunchContext) {
    warnings.push({
      type: "lunch_skipped",
      message: "Lunch was skipped because a patient's fixed window overlapped the lunch period.",
    });
  }

  if (workingHoursEndSeconds !== undefined && lastTaskEndSeconds > workingHoursEndSeconds) {
    const overByMinutes = Math.ceil((lastTaskEndSeconds - workingHoursEndSeconds) / 60);
    warnings.push({
      type: "outside_working_hours",
      overByMinutes,
      message: `Route extends ${overByMinutes} min past your working hours.`,
    });
  }

  return {
    start: {
      address: request.start.address,
      coords: startCoords,
      departureTime,
    },
    end: {
      address: request.end.address,
      coords: endCoords,
    },
    orderedStops,
    routeLegs,
    unscheduledTasks,
    ...(warnings.length > 0 ? { warnings } : {}),
    metrics: {
      fixedWindowViolations: fixedWindowViolations + unscheduledFixedWindowViolations,
      totalLateSeconds,
      totalWaitSeconds,
      totalDistanceMeters: drivingRoute.totalDistanceMeters,
      totalDistanceKm: drivingRoute.totalDistanceKm,
      totalDurationSeconds: drivingRoute.totalDurationSeconds,
    },
    algorithmVersion:
      request.preserveOrder === true ? `${ALGORITHM_VERSION}/preserved` : ALGORITHM_VERSION,
  };
};
