/** Client-safe inbox row. Keep this module free of server clients. */
export interface RecentThreadRow {
  id: string;
  subject: string | null;
  shortDisplayTitle: string | null;
  summary: string | null;
  status: string | null;
  importance: string | null;
  category: string | null;
  latestMessageAt: string | null;
}
