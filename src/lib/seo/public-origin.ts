/** Origin used on public legal pages and crawler files. Never include a trailing slash. */
export function publicAppOrigin(
  source: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = source.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return undefined;
  }
  return raw.replace(/\/+$/, "");
}
