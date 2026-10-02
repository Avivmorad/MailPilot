import { z } from "zod";

import { normalizeEmail } from "@/lib/gmail/addresses";
import { TRIAGE_LIST_MAX } from "@/lib/settings/limits";

export const triageSenderSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .transform((value) => normalizeEmail(value))
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), { message: "invalid_sender" });

export const triageDomainSchema = z
  .string()
  .trim()
  .max(253)
  .transform((value) => value.replace(/^@/, "").toLowerCase())
  .refine(
    (value) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value),
    { message: "invalid_domain" },
  );

/** Normalize one VIP/ignored sender email for chip Add. */
export function parseTriageSender(raw: string): { ok: true; value: string } | { ok: false } {
  const parsed = triageSenderSchema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

/** Normalize one ignored domain for chip Add. */
export function parseTriageDomain(raw: string): { ok: true; value: string } | { ok: false } {
  const parsed = triageDomainSchema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export const triageSenderListSchema = z
  .array(triageSenderSchema)
  .max(TRIAGE_LIST_MAX)
  .transform(uniqueStrings);

export const triageDomainListSchema = z
  .array(triageDomainSchema)
  .max(TRIAGE_LIST_MAX)
  .transform(uniqueStrings);
