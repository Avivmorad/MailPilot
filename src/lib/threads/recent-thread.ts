/** Client-safe inbox row. Keep this module free of server clients. */
export interface RecentThreadRow {
  id: string;
  subject: string | null;
  shortDisplayTitle: string | null;
  summary: string | null;
  status: string | null;
  urgency?: string | null;
  deadline?: string | null;
  importance: string | null;
  importanceReason: string | null;
  category: string | null;
  sender: string | null;
  latestMessageAt: string | null;
}
