import { z } from "zod";

export const TOP_ACTIONS_LIMIT = 8;

export const digestTopActionSchema = z.object({
  threadId: z.string().min(1),
  title: z.string().min(1),
  urgency: z.string().nullable(),
  deadline: z.string().nullable(),
  category: z.string().nullable(),
});

export type DigestTopAction = z.infer<typeof digestTopActionSchema>;

export const digestListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface DigestPeriodCounts {
  totalMessages: number;
  importantCount: number;
  actionCount: number;
  replyCount: number;
  waitingCount: number;
  informationalCount: number;
  ignoredCount: number;
}

export interface DigestMessageActivity {
  id: string;
  threadId: string;
}

export interface DigestThreadActivity {
  id: string;
  status: string | null;
  importance: string | null;
  requiresAction: boolean;
  requiresReply: boolean;
}

export interface DigestReport {
  id: string;
  userId: string;
  connectionId: string;
  periodStart: string;
  periodEnd: string;
  totalMessages: number;
  importantCount: number;
  actionCount: number;
  replyCount: number;
  waitingCount: number;
  informationalCount: number;
  ignoredCount: number;
  summaryText: string | null;
  topActions: DigestTopAction[];
  createdAt: string;
}
