export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const PRIVACY_POLICY_SECTIONS = [
  {
    id: "what-gmailpilot-is",
    title: "What GmailPilot is",
    body: "GmailPilot is an inbox triage product. You create a GmailPilot login, connect your own Gmail account, and GmailPilot scans a window of mail you choose. It classifies threads, applies GmailPilot/ labels in Gmail, and shows open tasks, waiting items, and an in-app digest. GmailPilot does not send, delete, or archive mail for you.",
  },
  {
    id: "gmail-access",
    title: "How GmailPilot uses Gmail",
    body: `GmailPilot requests the Gmail scope ${GMAIL_MODIFY_SCOPE}. That is the minimum scope that can both read threads and apply labels. GmailPilot creates labels in the GmailPilot/ namespace if they are missing. Mailboxes that already have MailPilot/ labels keep those labels so GmailPilot does not create duplicates. It stores the mapping from those labels to Gmail ids, and does not rename or delete your other labels. Refresh tokens are encrypted at rest and are never sent to the browser.`,
  },
  {
    id: "what-we-store",
    title: "What GmailPilot stores",
    body: "GmailPilot stores thread and message metadata (ids, headers, timestamps, direction), attachment filenames and types without the file bytes, AI summaries and action cards, scan history, digest snapshots, and your triage settings. It does not persist full email bodies long-term. Digests in the MVP appear in the app only; GmailPilot does not email your digest.",
  },
  {
    id: "your-controls",
    title: "Your controls",
    body: "In Settings you can disconnect Gmail (historical summaries stay until you delete them), delete analysis data (threads, messages, actions, digests, and scans; Gmail stays connected), or delete your GmailPilot account (revokes Gmail when possible and removes the login). You can also disconnect GmailPilot from your Google account permissions.",
  },
  {
    id: "limited-use",
    title: "Limited Use of Gmail data",
    body: "GmailPilot uses Gmail data only to provide or improve the user-facing features in the product: classification, GmailPilot/ labels, open tasks, waiting items, and in-app digests. It does not sell Gmail data, use it for advertising, or transfer it to other parties except processors needed to run the product (hosting and the Gemini API for classification). Humans do not read your mail as a product feature. A public launch still requires Google OAuth verification for gmail.modify and, because GmailPilot stores and transmits Gmail data on servers, Google’s restricted-scope security assessment (CASA) when Google requires it.",
  },
  {
    id: "google",
    title: "Google",
    body: "GmailPilot is not affiliated with Google. Use of Gmail is subject to Google’s terms and privacy policy. Limited test users can connect Gmail before Google OAuth verification. This privacy page and the terms page are the URLs to put on the Google Cloud OAuth consent screen.",
  },
] as const;
