import { HttpError } from "../../../../lib/http";
import type { LatLng } from "./types";

const GOOGLE_ROUTES_TIMEOUT_MS = 10000;

type MatrixElement = {
  originIndex: number;
  destinationIndex: number;
  duration?: unknown;
  status?: unknown;
  condition?: unknown;
};

type MatrixWaypoint = {
  waypoint: {
    location: {
      latLng: {
        latitude: number;
        longitude: number;
      };
    };
  };
};

type RpcStatus = {
  code?: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toWaypoint = (coords: LatLng): MatrixWaypoint => ({
  waypoint: {
    location: {
      latLng: {
        latitude: coords.lat,
        longitude: coords.lon,
      },
    },
  },
});

const parseGoogleDurationSeconds = (duration: unknown) => {
  if (typeof duration !== "string" || !duration.endsWith("s")) {
    throw new HttpError(503, "Google Routes matrix returned an invalid duration.");
  }

  const seconds = Number(duration.slice(0, -1));
  if (seconds !== seconds || seconds === Infinity || seconds === -Infinity) {
    throw new HttpError(503, "Google Routes matrix returned an invalid duration.");
  }

  return Math.max(0, Math.round(seconds));
};

const parseResponseElements = (rawPayload: string): MatrixElement[] => {
  const payload = rawPayload.trim();
  if (!payload) {
    throw new HttpError(503, "Google Routes matrix returned an empty response.");
  }

  const tryParseJson = (value: string): unknown => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  };

  const parsedJson = tryParseJson(payload);
  if (Array.isArray(parsedJson)) {
    const elements = parsedJson
      .filter((value): value is MatrixElement => isObject(value))
      .filter(
        (value) =>
          typeof value.originIndex === "number" && typeof value.destinationIndex === "number",
      );

    if (elements.length > 0) {
      return elements;
    }
  }

  if (isObject(parsedJson)) {
    if (Array.isArray(parsedJson.matrix)) {
      return parsedJson.matrix as MatrixElement[];
    }

    if (
      typeof parsedJson.originIndex === "number" &&
      typeof parsedJson.destinationIndex === "number"
    ) {
      return [parsedJson as MatrixElement];
    }
  }

  const lines = payload
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsedLines = lines
    .map((line) => tryParseJson(line))
    .filter((value): value is MatrixElement => value !== undefined && isObject(value))
    .filter(
      (value) =>
        typeof value.originIndex === "number" && typeof value.destinationIndex === "number",
    );

  if (parsedLines.length > 0) {
    return parsedLines;
  }

  throw new HttpError(503, "Google Routes matrix returned an invalid response payload.");
};

const isElementRouteUnavailable = (element: MatrixElement) => {
  if (element.condition && element.condition !== "ROUTE_EXISTS") {
    return true;
  }

  if (!isObject(element.status)) {
    return false;
  }

  const status = element.status as RpcStatus;
  return typeof status.code === "number" && status.code !== 0;
};

export type TravelMatrixNode = {
  locationKey: string;
  coords: LatLng;
};

export type TravelDurationMatrix = Map<string, Map<string, number>>;

export const buildPlanningTravelDurationMatrix = async (
  nodes: TravelMatrixNode[],
  apiKey: string,
): Promise<TravelDurationMatrix> => {
  const matrix: TravelDurationMatrix = new Map();

  nodes.forEach((fromNode) => {
    const row = new Map<string, number>();
    nodes.forEach((toNode) => {
      if (fromNode.locationKey === toNode.locationKey) {
        row.set(toNode.locationKey, 0);
      }
    });
    matrix.set(fromNode.locationKey, row);
  });

  if (nodes.length <= 1) {
    return matrix;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GOOGLE_ROUTES_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,status,condition",
      },
      body: JSON.stringify({
        origins: nodes.map((node) => toWaypoint(node.coords)),
        destinations: nodes.map((node) => toWaypoint(node.coords)),
        travelMode: "DRIVE",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(503, "Driving route matrix service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(500, "Google Routes API key is invalid or not authorized.");
    }

    if (response.status === 429) {
      throw new HttpError(
        503,
        "Driving route matrix service is rate-limited. Please try again shortly.",
      );
    }

    throw new HttpError(503, "Driving route matrix service returned an unexpected error.");
  }

  const payloadText = await response.text();
  const elements = parseResponseElements(payloadText);

  elements.forEach((element) => {
    if (isElementRouteUnavailable(element)) {
      return;
    }

    const originNode = nodes[element.originIndex];
    const destinationNode = nodes[element.destinationIndex];
    if (!originNode || !destinationNode) {
      throw new HttpError(503, "Google Routes matrix returned out-of-range indices.");
    }

    if (originNode.locationKey === destinationNode.locationKey) {
      return;
    }

    const durationSeconds = parseGoogleDurationSeconds(element.duration);
    const row = matrix.get(originNode.locationKey);
    if (!row) {
      throw new HttpError(503, "Google Routes matrix returned an unknown origin.");
    }

    row.set(destinationNode.locationKey, durationSeconds);
  });

  return matrix;
};
