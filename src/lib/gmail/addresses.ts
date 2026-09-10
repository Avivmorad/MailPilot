export type MessageDirection = "INBOUND" | "OUTBOUND" | "SELF" | "UNKNOWN";

export interface EmailAddress {
  email: string;
  name: string | null;
}

const ANGLE_ADDRESS = /^(?:"?([^"]*)"?\s*)?<([^>]+)>$/;

/**
 * Parse a single RFC 5322 mailbox like `Name <user@example.com>` or `user@example.com`.
 */
export function parseEmailAddress(raw: string | null | undefined): EmailAddress | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const angled = trimmed.match(ANGLE_ADDRESS);
  if (angled) {
    const name = angled[1]?.trim() || null;
    return { email: angled[2].trim().toLowerCase(), name };
  }

  const email = trimmed.replace(/^<|>$/g, "").trim().toLowerCase();
  if (!email.includes("@")) {
    return null;
  }
  return { email, name: null };
}

/**
 * Parse a header that may contain comma-separated addresses.
 */
export function parseAddressList(raw: string | null | undefined): EmailAddress[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => parseEmailAddress(part))
    .filter((value): value is EmailAddress => value !== null);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Classify message direction from the authenticated user's addresses.
 */
export function classifyDirection(input: {
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  userEmails: string[];
}): MessageDirection {
  const userSet = new Set(input.userEmails.map(normalizeEmail).filter(Boolean));
  if (userSet.size === 0 || !input.from) {
    return "UNKNOWN";
  }

  const fromUser = userSet.has(input.from.email);
  const recipients = [...input.to, ...input.cc];
  const toUser = recipients.some((address) => userSet.has(address.email));
  const toOther = recipients.some((address) => !userSet.has(address.email));

  if (fromUser && toUser && !toOther) {
    return "SELF";
  }
  if (fromUser) {
    return "OUTBOUND";
  }
  if (toUser) {
    return "INBOUND";
  }
  return "UNKNOWN";
}
