import { useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { responsiveStyles } from './responsiveStyles';
import type { GeocodedStop, OrderedStop, RouteLeg } from './types';

type RouteMapProps = {
  start: GeocodedStop;
  orderedStops: OrderedStop[];
  routeLegs: RouteLeg[];
};

export type RoutePoint = {
  label: string;
  address: string;
  lat: number;
  lon: number;
  markerLat: number;
  markerLon: number;
  markerText: string;
  markerVariant: 'start' | 'stop' | 'end';
  isEndingPoint?: boolean;
};

type FitToRouteProps = {
  points: Array<[number, number]>;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

function decodePolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / 1e5, lon / 1e5]);
  }

  return coordinates;
}

export function toPatientInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return '?';
  }

  const firstInitial = words[0].charAt(0).toUpperCase();
  const secondInitial =
    words.length > 1
      ? words[1].charAt(0).toUpperCase()
      : words[0].charAt(1).toUpperCase();

  if (secondInitial.length === 0) {
    return firstInitial;
  }

  return `${firstInitial}${secondInitial}`;
}

const DEFAULT_MARKER_SIZE = 32;
const MAX_MARKER_WIDTH = 84;
const MAX_VISIBLE_MARKER_INITIALS = 2;
const OVERLAP_CLUSTER_METERS = 25;
const OVERLAP_RADIUS_METERS = 18;

function distanceMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const metersPerDegreeLat = 111_320;
  const latMidRadians = ((latA + latB) * Math.PI) / 360;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(latMidRadians);
  const deltaLatMeters = (latA - latB) * metersPerDegreeLat;
  const deltaLonMeters = (lonA - lonB) * metersPerDegreeLon;

  return Math.sqrt(deltaLatMeters * deltaLatMeters + deltaLonMeters * deltaLonMeters);
}

export function buildStopMarkerText(tasks: OrderedStop['tasks']): string {
  if (tasks.length === 0) {
    return '';
  }

  const initials = tasks.map((task) => toPatientInitials(task.patientName));
  if (initials.length <= MAX_VISIBLE_MARKER_INITIALS) {
    return initials.join('+');
  }

  const remainingCount = initials.length - MAX_VISIBLE_MARKER_INITIALS;
  return `${initials.slice(0, MAX_VISIBLE_MARKER_INITIALS).join('+')}+${remainingCount}`;
}

export function computeMarkerIconMetrics(markerText: string): {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
} {
  const normalizedText = markerText.trim();
  const width = Math.min(
    MAX_MARKER_WIDTH,
    Math.max(DEFAULT_MARKER_SIZE, normalizedText.length * 8 + 16),
  );

  return {
    width,
    height: DEFAULT_MARKER_SIZE,
    anchorX: Math.round(width / 2),
    anchorY: Math.round(DEFAULT_MARKER_SIZE / 2),
  };
}

export function offsetOverlappingMarkers(points: RoutePoint[]): RoutePoint[] {
  const clusters: Array<{
    centerLat: number;
    centerLon: number;
    points: RoutePoint[];
  }> = [];

  points.forEach((point) => {
    const cluster = clusters.find((candidate) =>
      distanceMeters(point.lat, point.lon, candidate.centerLat, candidate.centerLon) <=
      OVERLAP_CLUSTER_METERS,
    );

    if (!cluster) {
      clusters.push({
        centerLat: point.lat,
        centerLon: point.lon,
        points: [point],
      });
      return;
    }

    cluster.points.push(point);
    const pointCount = cluster.points.length;
    cluster.centerLat =
      cluster.points.reduce((sum, clusterPoint) => sum + clusterPoint.lat, 0) / pointCount;
    cluster.centerLon =
      cluster.points.reduce((sum, clusterPoint) => sum + clusterPoint.lon, 0) / pointCount;
  });

  const metersPerDegreeLat = 111_320;

  return points.map((point) => {
    const cluster = clusters.find((candidate) => candidate.points.indexOf(point) >= 0);
    if (!cluster || cluster.points.length <= 1) {
      return point;
    }

    const pointIndex = cluster.points.indexOf(point);
    const angle = (2 * Math.PI * Math.max(pointIndex, 0)) / cluster.points.length;
    const latOffsetDegrees = (OVERLAP_RADIUS_METERS * Math.sin(angle)) / metersPerDegreeLat;
    const lonOffsetDegrees =
      (OVERLAP_RADIUS_METERS * Math.cos(angle)) /
      (metersPerDegreeLat * Math.max(Math.cos((point.lat * Math.PI) / 180), 0.2));

    return {
      ...point,
      markerLat: point.lat + latOffsetDegrees,
      markerLon: point.lon + lonOffsetDegrees,
    };
  });
}

function FitToRoute({ points }: FitToRouteProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }

    map.fitBounds(points, {
      padding: [36, 36],
    });
  }, [map, points]);

  return null;
}

type RouteMapCanvasProps = {
  defaultCenter: [number, number];
  polylinePoints: Array<[number, number]>;
  routePoints: RoutePoint[];
  className: string;
};

const markerVariantClasses: Record<RoutePoint['markerVariant'], string> = {
  start:
    'border-emerald-200 bg-emerald-500 text-white shadow-emerald-900/30',
  stop: 'border-blue-200 bg-blue-600 text-white shadow-blue-900/30',
  end: 'border-rose-200 bg-rose-500 text-white shadow-rose-900/30',
};

const createRouteMarkerIcon = (point: RoutePoint) => {
  const metrics = computeMarkerIconMetrics(point.markerText);

  return divIcon({
    className: 'bg-transparent border-0',
    html: `
      <div class="flex h-8 min-w-8 items-center justify-center rounded-full border-2 px-2 text-[11px] font-bold shadow-lg ${markerVariantClasses[point.markerVariant]}">
        ${point.markerText}
      </div>
    `,
    iconSize: [metrics.width, metrics.height],
    iconAnchor: [metrics.anchorX, metrics.anchorY],
    popupAnchor: [0, -14],
  });
};

function RouteMapCanvas({
  defaultCenter,
  polylinePoints,
  routePoints,
  className,
}: RouteMapCanvasProps) {
  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className={className}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToRoute points={polylinePoints} />

      <Polyline
        positions={polylinePoints}
        color="#0f172a"
        weight={8}
        opacity={0.18}
      />
      <Polyline
        positions={polylinePoints}
        color="#2563eb"
        weight={5}
        opacity={0.95}
      />

      {routePoints.map((point, index) => (
        <Marker
          key={`${point.label}-${point.address}-${index}`}
          position={[point.markerLat, point.markerLon]}
          icon={createRouteMarkerIcon(point)}
        >
          <Popup>
            <strong>{point.label}</strong>
            <br />
            {point.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function RouteMap({ start, orderedStops, routeLegs }: RouteMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const routePoints = useMemo<RoutePoint[]>(() => {
    const points: RoutePoint[] = [];

    if (isFiniteNumber(start?.coords?.lat) && isFiniteNumber(start?.coords?.lon)) {
      points.push({
        label: 'Start',
        address: start.address,
        lat: start.coords.lat,
        lon: start.coords.lon,
        markerLat: start.coords.lat,
        markerLon: start.coords.lon,
        markerText: 'S',
        markerVariant: 'start',
      });
    }

    orderedStops.forEach((stop, index) => {
      if (isFiniteNumber(stop?.coords?.lat) && isFiniteNumber(stop?.coords?.lon)) {
        const isEndingPoint = Boolean(stop.isEndingPoint);

        points.push({
          label: isEndingPoint
            ? 'End'
            : stop.tasks.length > 0
              ? stop.tasks
                  .map((task) => task.patientName)
                  .filter((name, taskIndex, names) => names.indexOf(name) === taskIndex)
                  .join(', ')
              : `Stop ${index + 1}`,
          address: stop.address,
          lat: stop.coords.lat,
          lon: stop.coords.lon,
          markerLat: stop.coords.lat,
          markerLon: stop.coords.lon,
          markerText: isEndingPoint
            ? 'E'
            : stop.tasks.length > 0
              ? buildStopMarkerText(stop.tasks)
              : String(index + 1),
          markerVariant: isEndingPoint ? 'end' : 'stop',
          isEndingPoint,
        });
      }
    });

    return offsetOverlappingMarkers(points);
  }, [orderedStops, start]);

  const polylinePoints = useMemo<Array<[number, number]>>(() => {
    const points: Array<[number, number]> = [];

    routeLegs.forEach((leg) => {
      const decodedPoints = decodePolyline(leg.encodedPolyline);
      decodedPoints.forEach((point) => {
        const previousPoint = points[points.length - 1];
        if (previousPoint && previousPoint[0] === point[0] && previousPoint[1] === point[1]) {
          return;
        }

        points.push(point);
      });
    });

    if (points.length > 0) {
      return points;
    }

    return routePoints.map((point) => [point.lat, point.lon]);
  }, [routeLegs, routePoints]);

  if (polylinePoints.length === 0) {
    return null;
  }

  const defaultCenter = polylinePoints[0];

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <div className="mb-3 mt-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="absolute right-3 top-3 z-[500] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:bg-slate-950"
          >
            Expand map
          </button>
          <RouteMapCanvas
            defaultCenter={defaultCenter}
            polylinePoints={polylinePoints}
            routePoints={routePoints}
            className={responsiveStyles.map}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-base font-semibold text-slate-100">
                  Full-size Route Map
                </h3>
                <p className="m-0 text-sm text-slate-400">
                  Press Escape or use close to return to the route summary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <RouteMapCanvas
              defaultCenter={defaultCenter}
              polylinePoints={polylinePoints}
              routePoints={routePoints}
              className="h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default RouteMap;
