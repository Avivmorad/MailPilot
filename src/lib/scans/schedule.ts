function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      bag[part.type] = part.value;
    }
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

function utcGuessForZonedLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const target = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += target - asUtc;
  }
  return new Date(guess);
}

function addCalendarDay(
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Next daily scan instant in UTC for a wall-clock time in `timeZone`.
 */
export function nextDailyScanAt(now: Date, timeHHmm: string, timeZone: string): Date {
  const [hoursRaw, minutesRaw] = timeHHmm.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error("daily_scan_time must be HH:MM");
  }

  const current = zonedParts(now, timeZone);
  const todayCandidate = utcGuessForZonedLocal(
    current.year,
    current.month,
    current.day,
    hours,
    minutes,
    timeZone,
  );
  if (todayCandidate.getTime() > now.getTime()) {
    return todayCandidate;
  }
  const next = addCalendarDay(current.year, current.month, current.day);
  return utcGuessForZonedLocal(next.year, next.month, next.day, hours, minutes, timeZone);
}

export const MAX_SCHEDULED_ATTEMPTS = 3;

const RETRY_DELAYS_MS = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;

/**
 * Bounded retry after a failed scheduled scan. After {@link MAX_SCHEDULED_ATTEMPTS}
 * the caller should fall back to the next daily slot instead.
 */
export function scheduledRetryAt(now: Date, failedAttempt: number): Date {
  const index = Math.min(Math.max(failedAttempt, 1), RETRY_DELAYS_MS.length) - 1;
  return new Date(now.getTime() + RETRY_DELAYS_MS[index]);
}

export function nextScanAfterFailure(
  now: Date,
  failedAttempt: number,
  dailyScanTime: string,
  timeZone: string,
): Date {
  if (failedAttempt >= MAX_SCHEDULED_ATTEMPTS) {
    return nextDailyScanAt(now, dailyScanTime, timeZone);
  }
  return scheduledRetryAt(now, failedAttempt);
}
