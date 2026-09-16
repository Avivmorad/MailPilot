export const TERMS_SECTIONS = [
  {
    id: "the-service",
    title: "The service",
    body: "MailPilot is an inbox triage product. After you create an account and connect Gmail, MailPilot can scan a window of mail you choose, classify threads, apply MailPilot/ labels, and show open tasks, pending items, and an in-app digest. MailPilot does not send, delete, or archive mail for you.",
  },
  {
    id: "your-account",
    title: "Your account",
    body: "You must only connect a Gmail account you are allowed to access. You are responsible for keeping your MailPilot login safe and for how you use the summaries and labels MailPilot creates. You can disconnect Gmail, delete stored analysis data, or delete your MailPilot account in Settings.",
  },
  {
    id: "limitations",
    title: "Limitations",
    body: "Classifications and action cards are machine-generated and can be wrong. MailPilot is provided as the current product works; scheduled scans and AI calls can fail, be delayed, or be incomplete. Do not rely on MailPilot as the only record of important mail.",
  },
  {
    id: "google",
    title: "Google",
    body: "MailPilot is not affiliated with Google. Connecting Gmail is also subject to Google’s terms and privacy policy. MailPilot requests only the gmail.modify scope so it can read threads and apply labels.",
  },
] as const;
