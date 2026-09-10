const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
