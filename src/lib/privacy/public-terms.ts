export const TERMS_SECTIONS = [
  {
    id: "the-service",
    title: "The service",
    body: "GmailPilot is an inbox triage product. After you create an account and connect Gmail, GmailPilot can scan a window of mail you choose, classify threads, apply GmailPilot/ labels, and show open tasks, waiting items, and an in-app digest. GmailPilot does not send, delete, or archive mail for you.",
  },
  {
    id: "your-account",
    title: "Your account",
    body: "You must only connect a Gmail account you are allowed to access. You are responsible for keeping your GmailPilot login safe and for how you use the summaries and labels GmailPilot creates. You can disconnect Gmail, delete stored analysis data, or delete your GmailPilot account in Settings.",
  },
  {
    id: "limitations",
    title: "Limitations",
    body: "Classifications and action cards are machine-generated and can be wrong. GmailPilot is provided as the current product works; scheduled scans and AI calls can fail, be delayed, or be incomplete. Do not rely on GmailPilot as the only record of important mail.",
  },
  {
    id: "google",
    title: "Google",
    body: "GmailPilot is not affiliated with Google. Connecting Gmail is also subject to Google’s terms and privacy policy. GmailPilot requests only the gmail.modify scope so it can read threads and apply labels.",
  },
] as const;
