import { useEffect, useMemo, useState } from "react";
import type { OrderedStop, OptimizeRouteResponse } from "../types";

type MoveDirection = "up" | "down";

const AVERAGE_DRIVE_SPEED_KM_PER_HOUR = 40;
const EARTH_RADIUS_KM = 6371;

type Coords = { lat: number; lon: number };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getStopCoords = (stop: OrderedStop): Coords | null => {
  if (
    stop.coords &&
    isFiniteNumber(stop.coords.lat) &&
    isFiniteNumber(stop.coords.lon)
  ) {
    return {
      lat: stop.coords.lat,
      lon: stop.coords.lon,
    };
  }

  return null;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistanceKm = (from: Coords, to: Coords) => {
  const latDelta = toRadians(to.lat - from.lat);
  const lonDelta = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

const roundDistanceKm = (value: number) => Number(value.toFixed(2));

const formatWindowStartMs = (referenceMs: number, windowStart: string) => {
  const [hoursPart, minutesPart] = windowStart.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return referenceMs;
  }

  const reference = new Date(referenceMs);
  const windowStartDate = new Date(reference);
  windowStartDate.setHours(hours, minutes, 0, 0);
  const candidate = windowStartDate.getTime();

  return candidate > referenceMs ? candidate : referenceMs;
};

const isMovableStop = (stop: OrderedStop) =>
  !stop.isEndingPoint && stop.tasks.length > 0;

const buildMovableStopIds = (orderedStops: OrderedStop[]) =>
  orderedStops.filter(isMovableStop).map((stop) => stop.stopId);

const applyManualOrder = (
  orderedStops: OrderedStop[],
  manualOrder: string[] | null,
) => {
  if (!manualOrder || manualOrder.length === 0) {
    return orderedStops;
  }

  const movableStops = orderedStops.filter(isMovableStop);
  const movableById = new Map(movableStops.map((stop) => [stop.stopId, stop]));
  const reorderedMovables = manualOrder
    .map((stopId) => movableById.get(stopId))
    .filter((stop): stop is OrderedStop => Boolean(stop));

  if (reorderedMovables.length !== movableStops.length) {
    return orderedStops;
  }

  let movableIndex = 0;
  return orderedStops.map((stop) => {
    if (!isMovableStop(stop)) {
      return stop;
    }

    const next = reorderedMovables[movableIndex];
    movableIndex += 1;
    return next ?? stop;
  });
};

const estimateStops = (
  orderedStops: OrderedStop[],
  resultStart: OptimizeRouteResponse["start"],
) => {
  const departureMs = new Date(resultStart.departureTime).getTime();
  const startCoords =
    isFiniteNumber(resultStart.coords?.lat) && isFiniteNumber(resultStart.coords?.lon)
      ? { lat: resultStart.coords.lat, lon: resultStart.coords.lon }
      : null;
  if (!Number.isFinite(departureMs) || !startCoords) {
    return orderedStops;
  }

  let cursorMs = departureMs;
  let previousCoords: Coords = startCoords;

  return orderedStops.map((stop) => {
    const stopCoords = getStopCoords(stop);
    if (!stopCoords) {
      return stop;
    }

    const distanceKm = haversineDistanceKm(previousCoords, stopCoords);
    const durationSeconds = Math.round(
      (distanceKm / AVERAGE_DRIVE_SPEED_KM_PER_HOUR) * 3600,
    );
    const arrivalMs = cursorMs + durationSeconds * 1000;

    let stopCursorMs = arrivalMs;
    const estimatedTasks = stop.tasks.map((task) => {
      const arrivalTimeMs = stopCursorMs;
      const serviceStartMs =
        task.windowStart && task.windowStart.length > 0
          ? formatWindowStartMs(arrivalTimeMs, task.windowStart)
          : arrivalTimeMs;
      const serviceDurationMs = Math.max(
        0,
        Math.round(task.serviceDurationMinutes * 60_000),
      );
      const serviceEndMs = serviceStartMs + serviceDurationMs;
      const waitSeconds = Math.max(
        0,
        Math.round((serviceStartMs - arrivalTimeMs) / 1000),
      );

      stopCursorMs = serviceEndMs;

      return {
        ...task,
        arrivalTime: new Date(arrivalTimeMs).toISOString(),
        serviceStartTime: new Date(serviceStartMs).toISOString(),
        serviceEndTime: new Date(serviceEndMs).toISOString(),
        waitSeconds,
      };
    });

    const departureMsForStop =
      estimatedTasks.length > 0 ? stopCursorMs : arrivalMs;
    cursorMs = departureMsForStop;
    previousCoords = stopCoords;

    return {
      ...stop,
      tasks: estimatedTasks,
      distanceFromPreviousKm: roundDistanceKm(distanceKm),
      durationFromPreviousSeconds: durationSeconds,
      arrivalTime: new Date(arrivalMs).toISOString(),
      departureTime: new Date(departureMsForStop).toISOString(),
    };
  });
};

const canMove = (orderedStopIds: string[], stopId: string, direction: MoveDirection) => {
  const index = orderedStopIds.indexOf(stopId);
  if (index < 0) {
    return false;
  }

  if (direction === "up") {
    return index > 0;
  }

  return index < orderedStopIds.length - 1;
};

export const useManualReorder = (result: OptimizeRouteResponse | null) => {
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    setManualOrder(null);
    setIsStale(false);
  }, [result]);

  const baseStops = result?.orderedStops ?? [];
  const fallbackMovableIds = useMemo(
    () => buildMovableStopIds(baseStops),
    [baseStops],
  );
  const orderedMovableIds = useMemo(
    () =>
      manualOrder && manualOrder.length > 0 ? manualOrder : fallbackMovableIds,
    [fallbackMovableIds, manualOrder],
  );

  const reorderedStops = useMemo(() => {
    if (!result) {
      return [] as OrderedStop[];
    }

    const ordered = applyManualOrder(result.orderedStops, manualOrder);
    if (!isStale) {
      return ordered;
    }

    return estimateStops(ordered, result.start);
  }, [isStale, manualOrder, result]);

  const moveStop = (stopId: string, direction: MoveDirection) => {
    if (!result) {
      return;
    }

    const currentOrder =
      manualOrder && manualOrder.length > 0
        ? [...manualOrder]
        : [...buildMovableStopIds(result.orderedStops)];
    const index = currentOrder.indexOf(stopId);
    if (index < 0) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const next = [...currentOrder];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    setManualOrder(next);
    setIsStale(true);
  };

  return {
    manualOrder,
    isStale,
    orderedStops: reorderedStops,
    moveStop,
    canMoveStop: (stopId: string, direction: MoveDirection) =>
      canMove(orderedMovableIds, stopId, direction),
    resetOrder: () => {
      setManualOrder(null);
      setIsStale(false);
    },
  };
};

