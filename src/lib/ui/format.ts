const DISPLAY_TZ = "Asia/Jerusalem";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
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
  return isoDate;
}
