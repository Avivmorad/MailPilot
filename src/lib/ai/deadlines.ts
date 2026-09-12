const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INJECTION_LINE = /ignore previous instructions|התעלם מהוראות קודמות/i;

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAME =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const MONTH_FIRST = new RegExp(
  `\\b(${MONTH_NAME})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
  "gi",
);
const DAY_FIRST = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAME}),?\\s+(\\d{4})\\b`,
  "gi",
);

/**
 * ISO calendar dates that appear in the thread, excluding prompt-injection lines.
 * Used so a model cannot keep a deadline that only exists in an instruction override.
 */
export function groundedIsoDates(threadText: string): Set<string> {
  const dates = new Set<string>();
  for (const line of threadText.split(/\r?\n/)) {
    if (INJECTION_LINE.test(line)) {
      continue;
    }
    for (const match of line.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
      const normalized = normalizeDeadline(match[1]);
      if (normalized) {
        dates.add(normalized);
      }
    }
    addNaturalLanguageDates(line, dates);
  }
  return dates;
}

function addNaturalLanguageDates(line: string, dates: Set<string>): void {
  for (const match of line.matchAll(MONTH_FIRST)) {
    const iso = isoFromParts(match[3], match[1], match[2]);
    if (iso) {
      dates.add(iso);
    }
  }
  for (const match of line.matchAll(DAY_FIRST)) {
    const iso = isoFromParts(match[3], match[2], match[1]);
    if (iso) {
      dates.add(iso);
    }
  }
}

function isoFromParts(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const month = MONTH_INDEX[monthRaw.toLowerCase()];
  if (!month) {
    return null;
  }
  return normalizeDeadline(
    `${yearRaw}-${String(month).padStart(2, "0")}-${dayRaw.padStart(2, "0")}`,
  );
}

export function groundDeadline(
  deadline: string | null | undefined,
  threadText: string | null | undefined,
  extraText?: string | null,
): string | null {
  const iso = normalizeDeadline(deadline);
  if (!iso) {
    return null;
  }
  if (threadText == null && extraText == null) {
    return iso;
  }
  const grounded = groundedIsoDates([threadText, extraText].filter(Boolean).join("\n"));
  return grounded.has(iso) ? iso : null;
}

/**
 * Accept only calendar dates in YYYY-MM-DD. Relative phrases, marketing
 * urgency, and invalid calendar days become null — never invent a date.
 */
export function normalizeDeadline(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(ISO_DATE);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}
