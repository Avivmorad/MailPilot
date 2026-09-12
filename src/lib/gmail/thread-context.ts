import { getContextLimits, type ContextLimits } from "@/lib/config/env";
import {
  classifyDirection,
  parseAddressList,
  parseEmailAddress,
  type MessageDirection,
} from "@/lib/gmail/addresses";
import { formatAttachmentsForPrompt, type ParsedGmailMessage } from "@/lib/gmail/parser";

export interface ThreadMessageContext {
  gmailMessageId: string;
  direction: MessageDirection;
  from: string | null;
  to: string | null;
  cc: string | null;
  date: string | null;
  subject: string | null;
  body: string;
  attachmentsNote: string;
}

export interface ThreadContext {
  messages: ThreadMessageContext[];
  promptText: string;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n[truncated]`;
}

function toIso(internalDate: string | null): string | null {
  if (!internalDate) {
    return null;
  }
  const millis = Number(internalDate);
  if (!Number.isFinite(millis)) {
    return null;
  }
  return new Date(millis).toISOString();
}

/**
 * Build a bounded, direction-aware thread representation for the triage model.
 * Latest message is kept fullest; older messages are truncated if needed.
 */
export function buildThreadContext(
  messages: ParsedGmailMessage[],
  userEmails: string[],
  limits: ContextLimits = getContextLimits(),
): ThreadContext {
  const chronological = [...messages].sort(
    (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
  );
  const window = chronological.slice(-limits.MAX_THREAD_MESSAGES);

  const mapped: ThreadMessageContext[] = window.map((message) => {
    const from = parseEmailAddress(message.from);
    const to = parseAddressList(message.to);
    const cc = parseAddressList(message.cc);
    return {
      gmailMessageId: message.gmailMessageId,
      direction: classifyDirection({ from, to, cc, userEmails }),
      from: message.from,
      to: message.to,
      cc: message.cc,
      date: toIso(message.internalDate),
      subject: message.subject,
      body: truncate(message.plainText, limits.MAX_MESSAGE_CHARS),
      attachmentsNote: formatAttachmentsForPrompt(message.attachments),
    };
  });

  const blocks = mapped.map((message, index) => {
    const lines = [
      `[MESSAGE ${index + 1}]`,
      `Direction: ${message.direction}`,
      `From: ${message.from ?? ""}`,
      `To: ${message.to ?? ""}`,
      `Cc: ${message.cc ?? ""}`,
      `Date: ${message.date ?? ""}`,
      `Subject: ${message.subject ?? ""}`,
      "",
      message.body,
    ];
    if (message.attachmentsNote) {
      lines.push("", message.attachmentsNote);
    }
    return lines.join("\n");
  });

  let promptText = blocks.join("\n\n");
  if (promptText.length > limits.MAX_THREAD_CHARS) {
    promptText = `${promptText.slice(0, limits.MAX_THREAD_CHARS)}\n[truncated]`;
  }

  return { messages: mapped, promptText };
}
