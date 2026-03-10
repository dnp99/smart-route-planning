import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { GeocodedStop, OrderedStop, RouteLeg } from './types';

type RouteMapProps = {
  start: GeocodedStop;
  orderedStops: OrderedStop[];
  routeLegs: RouteLeg[];
};

type RoutePoint = {
  label: string;
  address: string;
  lat: number;
  lon: number;
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
      padding: [24, 24],
    });
  }, [map, points]);

  return null;
}

function RouteMap({ start, orderedStops, routeLegs }: RouteMapProps) {
  const routePoints = useMemo<RoutePoint[]>(() => {
    const points: RoutePoint[] = [];

    if (isFiniteNumber(start?.coords?.lat) && isFiniteNumber(start?.coords?.lon)) {
      points.push({
        label: 'Start',
        address: start.address,
        lat: start.coords.lat,
        lon: start.coords.lon,
      });
    }

    orderedStops.forEach((stop, index) => {
      if (isFiniteNumber(stop?.coords?.lat) && isFiniteNumber(stop?.coords?.lon)) {
        const isEndingPoint = Boolean(stop.isEndingPoint);

        points.push({
          label: isEndingPoint ? 'End' : `Stop ${index + 1}`,
          address: stop.address,
          lat: stop.coords.lat,
          lon: stop.coords.lon,
          isEndingPoint,
        });
      }
    });

    return points;
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

  return (
    <div className="mb-3 mt-3">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="h-64 w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToRoute points={polylinePoints} />

        <Polyline positions={polylinePoints} color="#2563eb" weight={4} />

        {routePoints.map((point, index) => (
          <CircleMarker
            key={`${point.label}-${point.address}-${index}`}
            center={[point.lat, point.lon]}
            radius={index === 0 ? 8 : 6}
            pathOptions={{
              color: index === 0 ? '#16a34a' : point.isEndingPoint ? '#dc2626' : '#1d4ed8',
              fillColor: index === 0 ? '#16a34a' : point.isEndingPoint ? '#dc2626' : '#1d4ed8',
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{point.label}</strong>
              <br />
              {point.address}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default RouteMap;
