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
