/**
 * User-facing strings must never render as blank, the literal "null", or
 * "undefined" when a title or summary is expected.
 */
export function usableDisplayText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return null;
  }
  return trimmed;
}

export function displayThreadTitle(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const usable = usableDisplayText(candidate);
    if (usable) {
      return usable;
    }
  }
  return "Thread";
}

export function displayActionTitle(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const usable = usableDisplayText(candidate);
    if (usable) {
      return usable;
    }
  }
  return "Action";
}
