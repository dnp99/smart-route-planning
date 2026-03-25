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
} from "./types";
import type { ValidatedOptimizeRouteV2Request } from "./validation";
import {
  buildPlanningTravelDurationMatrix,
  type TravelDurationMatrix,
  type TravelMatrixNode,
} from "./travelMatrix";

const ALGORITHM_VERSION = "v2.5.3-edf-tier";
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

const computeMinuteAlignedLateBySeconds = (
  serviceStartSeconds: number,
  windowEndSeconds: number,
) => {
  const lateMinutes = Math.max(
    0,
    minuteBucket(serviceStartSeconds) - minuteBucket(windowEndSeconds),
  );
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
    return (
      left.totalWaitSeconds +
      left.totalTravelSeconds -
      (right.totalWaitSeconds + right.totalTravelSeconds)
    );
  }

  if (left.totalWaitSeconds !== right.totalWaitSeconds) {
    return left.totalWaitSeconds - right.totalWaitSeconds;
  }

  return left.totalTravelSeconds - right.totalTravelSeconds;
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
) => {
  if (left.windowStartSeconds !== right.windowStartSeconds) {
    return left.windowStartSeconds - right.windowStartSeconds;
  }

  if (left.windowType !== right.windowType) {
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
) => {
  const anchoredVisits = visits.filter((visit) => visit.hasPreferredWindow);
  if (anchoredVisits.length === 0) {
    return null;
  }

  const sortedVisits = [...anchoredVisits];
  sortedVisits.sort((left, right) =>
    compareDepartureAnchors(left, right, startLocation, resolveTravelSeconds),
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

  const firstAnchor = resolveFirstDepartureAnchor(visits, startLocation, resolveTravelSeconds);
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
    ? computeMinuteAlignedLateBySeconds(serviceStartSeconds, visit.windowEndSeconds)
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
      const anchorLateAfterFiller = anchor.hasPreferredWindow
        ? Math.max(0, anchorServiceStartAfterFiller - anchor.windowEndSeconds)
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
    const lateFlexibleProjections = !hasFixedRemaining
      ? projections.filter((p) => p.visit.hasPreferredWindow && p.lateBySeconds > 0)
      : [];
    const urgentFlexibleProjections =
      !hasFixedRemaining && lateFlexibleProjections.length === 0
        ? projections.filter(
            (p) =>
              p.visit.hasPreferredWindow &&
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
      !hasFixedRemaining &&
      lateFlexibleProjections.length === 0 &&
      urgentFlexibleProjections.length === 0
        ? projections.filter((p) => p.visit.hasPreferredWindow)
        : [];
    const primaryProjections =
      lateFixedProjections.length > 0
        ? lateFixedProjections
        : hasFixedRemaining
          ? projections.filter((p) => p.visit.windowType === "fixed")
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

    const selected = maybeSelectGapFiller(
      firstProjection,
      projections,
      currentTimeSeconds,
      resolveTravelSeconds,
      objective,
    );
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
  const lateBySeconds = task.hasPreferredWindow
    ? computeMinuteAlignedLateBySeconds(serviceStartSeconds, task.windowEndSeconds)
    : 0;
  const serviceEndSeconds = serviceStartSeconds + task.serviceDurationMinutes * 60;

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

export const optimizeRouteV2 = async (
  request: ValidatedOptimizeRouteV2Request,
  googleMapsApiKey: string,
): Promise<OptimizeRouteResultV2> => {
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
  );
  const departureTimestampMs = departureContext.departureTimestampMs;
  const departureLocalSeconds = departureContext.departureLocalSeconds;

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

  const { orderedVisits, unscheduledTasks, lunchSkippedDueToFixed } =
    orderVisitsByWindowDistanceAndDuration(
      visitsWithCoords,
      {
        coords: startCoords,
        locationKey: startLocationKey,
      },
      departureLocalSeconds,
      resolveTravelSeconds,
      request.preserveOrder === true,
      lunchContext,
      request.optimizationObjective ?? "distance",
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
      departureTime: departureContext.departureTime,
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
