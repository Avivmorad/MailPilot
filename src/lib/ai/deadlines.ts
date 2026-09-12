const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INJECTION_LINE = /ignore previous instructions/i;

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
  }
  return dates;
}

export function groundDeadline(
  deadline: string | null | undefined,
  threadText: string | null | undefined,
): string | null {
  const iso = normalizeDeadline(deadline);
  if (!iso) {
    return null;
  }
  if (threadText == null) {
    return iso;
  }
  return groundedIsoDates(threadText).has(iso) ? iso : null;
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
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}
