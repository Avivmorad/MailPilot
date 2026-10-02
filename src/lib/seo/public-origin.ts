/** Chosen public host. Owner tasks sections 2 and 3 record the live settings. */
export const LAUNCH_APP_ORIGIN = "https://mail-priority.vercel.app";

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
