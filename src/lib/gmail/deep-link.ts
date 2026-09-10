/**
 * Gmail thread URL (spec §32). Prefer authuser + all-mail hash; search is the fallback.
 */
export function gmailThreadUrl(gmailEmail: string, gmailThreadId: string): string {
  const email = gmailEmail.trim();
  const threadId = gmailThreadId.trim();
  if (!email || !threadId) {
    return "https://mail.google.com/mail/";
  }
  const params = new URLSearchParams({ authuser: email });
  return `https://mail.google.com/mail/?${params.toString()}#all/${encodeURIComponent(threadId)}`;
}

export function gmailSearchFallbackUrl(gmailEmail: string, subject: string | null): string {
  const query = subject?.trim() ? `subject:${subject.trim()}` : "";
  const params = new URLSearchParams({ authuser: gmailEmail, q: query });
  return `https://mail.google.com/mail/?${params.toString()}#search/${encodeURIComponent(query)}`;
}
