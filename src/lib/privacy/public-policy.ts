export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const PRIVACY_POLICY_SECTIONS = [
  {
    id: "what-mailpilot-is",
    title: "What MailPriority is",
    body: "MailPriority is an inbox triage product. You create a MailPriority login, connect your own Gmail account, and MailPriority scans a window of mail you choose. It classifies threads, applies MailPilot/ labels in Gmail, and shows actions, pending items, and an in-app digest. MailPriority does not send, delete, or archive mail for you.",
  },
  {
    id: "gmail-access",
    title: "How MailPriority uses Gmail",
    body: `MailPriority requests the Gmail scope ${GMAIL_MODIFY_SCOPE}. That is the minimum scope that can both read threads and apply labels. MailPriority creates labels in the MailPilot/ namespace if they are missing, stores the mapping from those labels to Gmail ids, and does not rename or delete your other labels. Refresh tokens are encrypted at rest and are never sent to the browser.`,
  },
  {
    id: "what-we-store",
    title: "What MailPriority stores",
    body: "MailPriority stores thread and message metadata (ids, headers, timestamps, direction), attachment filenames and types without the file bytes, AI summaries and action cards, scan history, digest snapshots, and your triage settings. Classification calls also store token counts and a priced estimate per call, with no message content. It does not persist full email bodies long-term. Digests in the MVP appear in the app only; MailPriority does not email your digest.",
  },
  {
    id: "your-controls",
    title: "Your controls",
    body: "In Settings you can disconnect Gmail (historical summaries stay until you delete them), delete analysis data (threads, messages, actions, digests, scans, and classification usage; Gmail stays connected), or delete your MailPriority account (revokes Gmail when possible and removes the login). You can also disconnect MailPriority from your Google account permissions.",
  },
  {
    id: "limited-use",
    title: "Limited Use of Gmail data",
    body: "MailPriority uses Gmail data only to provide or improve the user-facing features in the product: classification, MailPilot/ labels, actions, pending items, and in-app digests. It does not sell Gmail data, use it for advertising, or transfer it to other parties except processors needed to run the product (hosting, and either NVIDIA Build or the Gemini API for classification, depending on which key is configured). Humans do not read your mail as a product feature. A public launch still requires Google OAuth verification for gmail.modify and, because MailPriority stores and transmits Gmail data on servers, Google’s restricted-scope security assessment (CASA) when Google requires it.",
  },
  {
    id: "google",
    title: "Google",
    body: "MailPriority is not affiliated with Google. Use of Gmail is subject to Google’s terms and privacy policy. Limited test users can connect Gmail before Google OAuth verification. This privacy page and the terms page are the URLs to put on the Google Cloud OAuth consent screen.",
  },
] as const;
