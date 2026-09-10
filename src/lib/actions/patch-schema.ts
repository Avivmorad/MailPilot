import { z } from "zod";

export const SNOOZE_DAYS = [1, 3, 7] as const;
export type SnoozeDays = (typeof SNOOZE_DAYS)[number];

export const actionPatchSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("complete") }),
  z.object({ op: z.literal("reopen") }),
  z.object({
    op: z.literal("snooze"),
    days: z
      .number()
      .int()
      .refine((value): value is SnoozeDays => (SNOOZE_DAYS as readonly number[]).includes(value)),
  }),
]);

export type ActionPatch = z.infer<typeof actionPatchSchema>;
