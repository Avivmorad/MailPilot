import { normalizeDeadline } from "@/lib/ai/deadlines";
import { z } from "zod";

export const SNOOZE_DAYS = [1, 3, 7] as const;
export type SnoozeDays = (typeof SNOOZE_DAYS)[number];
export const MAX_SNOOZE_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const snoozeDaysSchema = z
  .number()
  .int()
  .refine((value): value is SnoozeDays => (SNOOZE_DAYS as readonly number[]).includes(value));

export const actionPatchSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("complete") }),
  z.object({ op: z.literal("reopen") }),
  z
    .object({
      op: z.literal("snooze"),
      days: snoozeDaysSchema.optional(),
      until: z
        .string()
        .regex(ISO_DATE)
        .refine((value) => normalizeDeadline(value) === value, { message: "invalid_calendar_date" })
        .optional(),
    })
    .superRefine((value, ctx) => {
      const hasDays = value.days != null;
      const hasUntil = Boolean(value.until);
      if (hasDays === hasUntil) {
        ctx.addIssue({
          code: "custom",
          message: "Snooze requires either days or until.",
        });
      }
    }),
  z.object({
    op: z.literal("wait"),
    waitingFor: z.string().trim().min(1).max(200),
  }),
]);

export type ActionPatch = z.infer<typeof actionPatchSchema>;
