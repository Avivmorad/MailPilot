import type { gmail_v1 } from "googleapis";

export interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  size: number;
}

export interface ParsedGmailMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  historyId: string | null;
  internalDate: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  subject: string | null;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  references: string | null;
  labelIds: string[];
  snippet: string | null;
  plainText: string;
  hasAttachments: boolean;
  attachments: AttachmentMetadata[];
}

const TEXT_MIME = /^text\/plain/i;
const HTML_MIME = /^text\/html/i;

export function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<img[^>]*>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|tr|li|blockquote)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return normalizeWhitespace(text);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | null {
  const match = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  const value = match?.value?.trim();
  return value ? value : null;
}

function isAttachmentPart(part: gmail_v1.Schema$MessagePart): boolean {
  const disposition = headerValue(part.headers, "Content-Disposition") ?? "";
  if (/attachment/i.test(disposition)) {
    return true;
  }
  if (part.filename && part.filename.length > 0) {
    return true;
  }
  return Boolean(part.body?.attachmentId);
}

function walkParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: { plains: string[]; htmls: string[]; attachments: AttachmentMetadata[] },
): void {
  if (!part) {
    return;
  }

  if (part.parts && part.parts.length > 0) {
    for (const child of part.parts) {
      walkParts(child, acc);
    }
    return;
  }

  const mimeType = part.mimeType ?? "";
  const data = part.body?.data;

  if (isAttachmentPart(part) && !TEXT_MIME.test(mimeType) && !HTML_MIME.test(mimeType)) {
    acc.attachments.push({
      filename: part.filename || "unnamed",
      mimeType: mimeType || "application/octet-stream",
      size: part.body?.size ?? 0,
    });
    return;
  }

  if (TEXT_MIME.test(mimeType) && data) {
    acc.plains.push(decodeBase64Url(data));
    return;
  }

  if (HTML_MIME.test(mimeType) && data) {
    acc.htmls.push(decodeBase64Url(data));
    return;
  }

  if (isAttachmentPart(part)) {
    acc.attachments.push({
      filename: part.filename || "unnamed",
      mimeType: mimeType || "application/octet-stream",
      size: part.body?.size ?? 0,
    });
  }
}

/**
 * Parse a Gmail API message resource. Attachment bodies are ignored;
 * only filename/mimeType/size metadata is kept.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage {
  const payload = message.payload;
  const headers = payload?.headers;
  const acc = {
    plains: [] as string[],
    htmls: [] as string[],
    attachments: [] as AttachmentMetadata[],
  };
  walkParts(payload, acc);

  let plainText = acc.plains.map(normalizeWhitespace).filter(Boolean).join("\n\n");
  if (!plainText && acc.htmls.length > 0) {
    plainText = acc.htmls.map(htmlToText).filter(Boolean).join("\n\n");
  }

  return {
    gmailMessageId: message.id ?? "",
    gmailThreadId: message.threadId ?? "",
    historyId: message.historyId ?? null,
    internalDate: message.internalDate ?? null,
    from: headerValue(headers, "From"),
    to: headerValue(headers, "To"),
    cc: headerValue(headers, "Cc"),
    bcc: headerValue(headers, "Bcc"),
    subject: headerValue(headers, "Subject"),
    messageIdHeader: headerValue(headers, "Message-ID") ?? headerValue(headers, "Message-Id"),
    inReplyTo: headerValue(headers, "In-Reply-To"),
    references: headerValue(headers, "References"),
    labelIds: message.labelIds ?? [],
    snippet: message.snippet ?? null,
    plainText,
    hasAttachments: acc.attachments.length > 0,
    attachments: acc.attachments,
  };
}

export function formatAttachmentsForPrompt(attachments: AttachmentMetadata[]): string {
  if (attachments.length === 0) {
    return "";
  }
  const lines = attachments.map((item) => `- ${item.filename} (${item.mimeType})`);
  return `Attachments:\n${lines.join("\n")}\n\nAttachment contents were not analyzed.`;
}
