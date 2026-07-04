// Presentational formatters for the admin dashboard. Pure functions kept out of
// the .tsx views.

export const formatDate = (iso: string | null): string => {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatRelative = (iso: string | null, now = new Date()): string => {
  if (!iso) {
    return "Never";
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "Never";
  }

  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return "Just now";
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return formatDate(iso);
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const ACTION_LABELS: Record<string, string> = {
  signup: "Signed up",
  login: "Logged in",
  "patients.create": "Added a client",
  "patients.update": "Edited a client",
  "patients.archive": "Archived a client",
  "patients.restore": "Restored a client",
  "patients.permanent_delete": "Permanently deleted a client",
  "recurring_templates.create": "Created a recurring template",
  "recurring_templates.update": "Edited a recurring template",
  "recurring_templates.delete": "Deleted a recurring template",
  "optimize.v3": "Optimized a route",
  "route.advisor": "Requested AI route advice",
  reschedule: "Rescheduled a visit",
  skip: "Skipped a visit",
};

export const describeAction = (action: string): string => ACTION_LABELS[action] ?? action;

export const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
};

export const formatDistanceKm = (totalMeters: number): string =>
  `${(totalMeters / 1000).toFixed(1)} km`;
