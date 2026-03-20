type GoogleMapsRouteInput = {
  start: {
    address: string;
  };
  end: {
    address: string;
  };
  orderedStops: Array<{
    address: string;
    isEndingPoint?: boolean;
  }>;
};

export const formatDuration = (durationSeconds: number) => {
  const totalMinutes = Math.floor(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
};

export const buildGoogleMapsTripUrl = (result: GoogleMapsRouteInput) => {
  const baseUrl = new URL("https://www.google.com/maps/dir/");
  baseUrl.searchParams.set("api", "1");
  baseUrl.searchParams.set("travelmode", "driving");
  baseUrl.searchParams.set("origin", result.start.address);
  baseUrl.searchParams.set("destination", result.end.address);

  const waypointAddresses = result.orderedStops
    .filter((stop) => !stop.isEndingPoint)
    .map((stop) => stop.address);

  if (waypointAddresses.length > 0) {
    baseUrl.searchParams.set("waypoints", waypointAddresses.join("|"));
  }

  return baseUrl.toString();
};
