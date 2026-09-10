const DISPLAY_TZ = "Asia/Jerusalem";

function parseInstant(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseInstant(iso);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "—";
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  const date = dateOnly ? new Date(`${isoDate}T12:00:00.000Z`) : parseInstant(isoDate);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: dateOnly ? "UTC" : DISPLAY_TZ,
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) {
    return "—";
  }
  const date = parseInstant(iso);
  if (!date) {
    return "—";
  }
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.round(Math.abs(diffMs) / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return formatDateTime(iso);
}
