export type StudioLane = "open" | "pending" | "fyi" | "snoozed";

export interface StudioItem {
  id: string;
  lane: StudioLane;
  sender: string;
  address: string;
  title: string;
  preview: string;
  category: string;
  when: string;
  dueLabel?: string;
  urgency: "high" | "normal" | "low";
  nextStep: string;
  why: string;
  messages: { at: string; text: string }[];
}

export const STUDIO_ITEMS: StudioItem[] = [
  {
    id: "reg",
    lane: "open",
    sender: "University Registrar",
    address: "registrar@university.edu",
    title: "Fall registration closes Tuesday",
    preview: "Choose courses and submit registration before the deadline.",
    category: "Education",
    when: "9:12 AM",
    dueLabel: "Tomorrow",
    urgency: "high",
    nextStep: "Submit course registration before Tuesday, Sep 29.",
    why: "A missed deadline can limit course options or add a late fee.",
    messages: [
      {
        at: "Sep 26, 9:12 AM",
        text: "Fall 2026 registration closes Tuesday, Sep 29. Open the catalog and confirm your selections.",
      },
    ],
  },
  {
    id: "login",
    lane: "open",
    sender: "Google",
    address: "no-reply@accounts.google.com",
    title: "New Windows sign-in",
    preview: "Confirm the sign-in was yours, or secure the account.",
    category: "Security",
    when: "9:01 AM",
    dueLabel: "Today",
    urgency: "high",
    nextStep: "Confirm the Windows sign-in from San Francisco, or secure the account.",
    why: "Unrecognized device sign-ins stay in Actions until you decide.",
    messages: [
      {
        at: "Sep 27, 9:14 AM",
        text: "A new sign-in to your Google Account from a Windows device in San Francisco, CA.",
      },
      {
        at: "Sep 27, 9:12 AM",
        text: "Review activity and devices if this was not you.",
      },
    ],
  },
  {
    id: "invoice",
    lane: "open",
    sender: "Acme, Inc.",
    address: "billing@acme.example",
    title: "Approve September invoice",
    preview: "Approve $2,480 for September services.",
    category: "Finance",
    when: "Sep 26",
    dueLabel: "Wed",
    urgency: "normal",
    nextStep: "Approve or dispute the $2,480 September invoice.",
    why: "Payment still needs a decision from you.",
    messages: [
      { at: "Sep 26, 8:21 AM", text: "Invoice for September services is ready for approval." },
    ],
  },
  {
    id: "hotel",
    lane: "pending",
    sender: "Booking.com",
    address: "noreply@booking.com",
    title: "Question sent to the hotel",
    preview: "They confirmed your smart-TV question was forwarded.",
    category: "Travel",
    when: "Yesterday",
    urgency: "low",
    nextStep: "Wait for the hotel. MailPriority will surface a reply.",
    why: "You already asked. The next move belongs to them.",
    messages: [{ at: "Sep 27, 4:12 PM", text: "Your question was forwarded to the property." }],
  },
  {
    id: "notion",
    lane: "pending",
    sender: "Alex Chen",
    address: "alex@notion.example",
    title: "Partnership proposal",
    preview: "You replied with availability. Waiting for their response.",
    category: "Career",
    when: "Yesterday",
    urgency: "low",
    nextStep: "No action until they pick a time.",
    why: "Your reply is sent. This stays Pending, not Actions.",
    messages: [{ at: "Sep 27, 1:03 PM", text: "Thanks — I'll send times that work." }],
  },
  {
    id: "stripe",
    lane: "fyi",
    sender: "Stripe",
    address: "receipts@stripe.com",
    title: "September receipt",
    preview: "Payment of $20.00 for MailPriority Pro.",
    category: "Finance",
    when: "Sep 25",
    urgency: "low",
    nextStep: "Nothing to do. Keep it for your records.",
why: "A receipt with no remaining decision stays For You.",
    messages: [{ at: "Sep 25, 10:24 AM", text: "Payment of $20.00 for MailPriority Pro." }],
  },
  {
    id: "linear",
    lane: "fyi",
    sender: "Linear",
    address: "noreply@linear.app",
    title: "Weekly product changelog",
    preview: "Placement reasons, undo, and a quieter dashboard.",
    category: "Product",
    when: "Fri",
    urgency: "low",
    nextStep: "Read only if you want the product notes.",
    why: "Useful context, no task.",
    messages: [{ at: "Sep 26, 6:18 PM", text: "This week: clearer placement and a calmer inbox." }],
  },
];

export function resolveVisibleSelection<T extends { id: string }>(
  list: readonly T[],
  selectedId: string,
): T | undefined {
  return list.find((item) => item.id === selectedId) ?? list[0];
}

export function countLane(items: StudioItem[], lane: StudioLane): number {
  return items.filter((item) => item.lane === lane).length;
}
