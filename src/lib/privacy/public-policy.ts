export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const PRIVACY_POLICY_SECTIONS = [
  {
    id: "what-mailpilot-is",
    title: "What MailPilot is",
    body: "MailPilot is an inbox triage product. You create a MailPilot login, connect your own Gmail account, and MailPilot scans a window of mail you choose. It classifies threads, applies MailPilot/ labels in Gmail, and shows open tasks, pending items, and an in-app digest. MailPilot does not send, delete, or archive mail for you.",
  },
  {
    id: "gmail-access",
    title: "How MailPilot uses Gmail",
    body: `MailPilot requests the Gmail scope ${GMAIL_MODIFY_SCOPE}. That is the minimum scope that can both read threads and apply labels. MailPilot creates labels in the MailPilot/ namespace if they are missing, stores the mapping from those labels to Gmail ids, and does not rename or delete your other labels. Refresh tokens are encrypted at rest and are never sent to the browser.`,
  },
  {
    id: "what-we-store",
    title: "What MailPilot stores",
    body: "MailPilot stores thread and message metadata (ids, headers, timestamps, direction), attachment filenames and types without the file bytes, AI summaries and action cards, scan history, digest snapshots, and your triage settings. It does not persist full email bodies long-term. Digests in the MVP appear in the app only; MailPilot does not email your digest.",
  },
  {
    id: "your-controls",
    title: "Your controls",
    body: "In Settings you can disconnect Gmail (historical summaries stay until you delete them), delete analysis data (threads, messages, actions, digests, and scans; Gmail stays connected), or delete your MailPilot account (revokes Gmail when possible and removes the login). You can also disconnect MailPilot from your Google account permissions.",
  },
  {
    id: "limited-use",
    title: "Limited Use of Gmail data",
    body: "MailPilot uses Gmail data only to provide or improve the user-facing features in the product: classification, MailPilot/ labels, open tasks, pending items, and in-app digests. It does not sell Gmail data, use it for advertising, or transfer it to other parties except processors needed to run the product (hosting and the Gemini API for classification). Humans do not read your mail as a product feature. A public launch still requires Google OAuth verification for gmail.modify and, because MailPilot stores and transmits Gmail data on servers, Google’s restricted-scope security assessment (CASA) when Google requires it.",
  },
  {
    id: "google",
    title: "Google",
    body: "MailPilot is not affiliated with Google. Use of Gmail is subject to Google’s terms and privacy policy. Limited test users can connect Gmail before Google OAuth verification. This privacy page and the terms page are the URLs to put on the Google Cloud OAuth consent screen.",
  },
] as const;
