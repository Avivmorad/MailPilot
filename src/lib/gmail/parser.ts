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
const BLOCK_TAGS = new Set(["p", "div", "tr", "li", "blockquote"]);
const RAW_TEXT_TAGS = new Set(["script", "style", "noscript"]);

export const MIME_PARSE_LIMITS = {
  decodedBodyBytes: 1024 * 1024,
  parts: 256,
  depth: 32,
  threadMessages: 1000,
  threadParts: 4096,
  threadDecodedBodyBytes: 8 * 1024 * 1024,
  metadataBytes: 64 * 1024,
  metadataFields: 512,
  threadMetadataBytes: 4 * 1024 * 1024,
  threadMetadataFields: 64 * 1024,
} as const;

export class GmailMimeLimitError extends Error {
  constructor(
    readonly reason:
      | "body_bytes"
      | "encoded_body"
      | "html_chars"
      | "parts"
      | "depth"
      | "thread_messages"
      | "thread_parts"
      | "metadata_bytes"
      | "metadata_fields"
      | "thread_metadata_bytes"
      | "thread_metadata_fields",
  ) {
    super(`Email content exceeded safe parsing limits (${reason}).`);
    this.name = "GmailMimeLimitError";
  }
}

function decodeBodyBytes(data: string, remainingBytes: number): Buffer {
  // Check the encoded representation before allocating a decoded buffer. Do not
  // trust MIME size metadata or silently classify a truncated body.
  if (data.length > Math.ceil(remainingBytes / 3) * 4) {
    throw new GmailMimeLimitError("encoded_body");
  }
  const decoded = Buffer.from(data, "base64url");
  if (decoded.length > remainingBytes) throw new GmailMimeLimitError("body_bytes");
  return decoded;
}

export function decodeBase64Url(data: string): string {
  return decodeBodyBytes(data, MIME_PARSE_LIMITS.decodedBodyBytes).toString("utf8");
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
  if (html.length > MIME_PARSE_LIMITS.decodedBodyBytes) throw new GmailMimeLimitError("html_chars");
  // ASCII folding preserves offsets (Unicode lowercasing can expand characters).
  // Construct this bounded representation once, not once per raw-text block.
  const lowerHtml = html.replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 32));
  const absentRawClosings = new Set<string>();
  const text: string[] = [];
  let ignoredTag: string | null = null;
  let index = 0;
  let atLineStart = true;

  const pushText = (value: string) => {
    text.push(value);
    if (value.trim()) {
      atLineStart = false;
    }
  };

  const pushNewline = () => {
    if (text[text.length - 1] !== "\n") {
      text.push("\n");
    }
    atLineStart = true;
  };

  while (index < html.length) {
    if (ignoredTag) {
      const closeStart = absentRawClosings.has(ignoredTag)
        ? -1
        : findRawClosing(lowerHtml, ignoredTag, index);
      if (closeStart === -1) {
        // At most one failed suffix search per raw-tag kind. Later positions
        // cannot contain a closing tag absent from this already-searched suffix.
        absentRawClosings.add(ignoredTag);
        // Malformed newsletters sometimes omit </style> or </script>; resume parsing
        // instead of dropping the rest of the message.
        ignoredTag = null;
        continue;
      }

      const closeTagEnd = findTagEnd(html, closeStart);
      if (closeTagEnd === -1) {
        absentRawClosings.add(ignoredTag);
        ignoredTag = null;
        continue;
      }

      index = closeTagEnd + 1;
      ignoredTag = null;
      continue;
    }

    if (html.startsWith("<!--", index)) {
      const commentEnd = findCommentEnd(html, index + 4);
      index = commentEnd === -1 ? html.length : commentEnd;
      continue;
    }

    if (html[index] === "<") {
      const tagEnd = findTagEnd(html, index);
      if (tagEnd === -1) {
        pushText(html.slice(index));
        break;
      }

      const tag = readTag(html.slice(index + 1, tagEnd));
      if (tag) {
        if (!tag.closing && RAW_TEXT_TAGS.has(tag.name)) {
          ignoredTag = tag.name;
        } else if (tag.name === "br") {
          pushNewline();
        } else if (!tag.closing && isHeadingTag(tag.name)) {
          if (!atLineStart) {
            pushNewline();
          }
        } else if (!tag.closing && tag.name === "li") {
          if (!atLineStart) {
            pushNewline();
          }
        } else if (tag.closing && (BLOCK_TAGS.has(tag.name) || isHeadingTag(tag.name))) {
          pushNewline();
        }
      }
      index = tagEnd + 1;
      continue;
    }

    const nextTag = html.indexOf("<", index);
    const textEnd = nextTag === -1 ? html.length : nextTag;
    pushText(html.slice(index, textEnd));
    index = textEnd;
  }

  return normalizeWhitespace(decodeHtmlEntities(text.join("")));
}

function findRawClosing(lowerHtml: string, tag: string, start: number): number {
  const needle = `</${tag}`;
  let found = lowerHtml.indexOf(needle, start);
  while (found !== -1) {
    const next = lowerHtml[found + needle.length];
    if (next === undefined || /[\s/>]/.test(next)) return found;
    found = lowerHtml.indexOf(needle, found + needle.length);
  }
  return -1;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&amp;/gi, "&");
}

function findCommentEnd(html: string, start: number): number {
  for (let index = start; index < html.length; index += 1) {
    if (html.startsWith("-->", index)) {
      return index + 3;
    }
    if (html.startsWith("--!>", index)) {
      return index + 4;
    }
  }
  return -1;
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;

  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }
  }

  return -1;
}

function readTag(raw: string): { closing: boolean; name: string } | null {
  const tag = raw.trim();
  if (!tag || tag.startsWith("!") || tag.startsWith("?")) {
    return null;
  }

  const closing = tag.startsWith("/");
  const content = closing ? tag.slice(1).trimStart() : tag;
  const match = /^[a-z0-9-]+/i.exec(content);
  if (!match) {
    return null;
  }

  return { closing, name: match[0].toLowerCase() };
}

function isHeadingTag(name: string): boolean {
  return /^h[1-6]$/i.test(name);
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

interface ParseBudget {
  decodedBytes: number;
  parts: number;
  metadataBytes: number;
  metadataFields: number;
}

function accountMetadata(
  value: string | null | undefined,
  budget: ParseBudget,
  thread?: ParseBudget,
) {
  if (value == null) return;
  budget.metadataFields += 1;
  if (budget.metadataFields > MIME_PARSE_LIMITS.metadataFields)
    throw new GmailMimeLimitError("metadata_fields");
  if (thread) {
    thread.metadataFields += 1;
    if (thread.metadataFields > MIME_PARSE_LIMITS.threadMetadataFields)
      throw new GmailMimeLimitError("thread_metadata_fields");
  }
  const remaining = Math.min(
    MIME_PARSE_LIMITS.metadataBytes - budget.metadataBytes,
    thread
      ? MIME_PARSE_LIMITS.threadMetadataBytes - thread.metadataBytes
      : Number.POSITIVE_INFINITY,
  );
  // UTF-8 byte length is at least the UTF-16 code-unit length; reject very
  // large values before measuring or normalizing their full contents.
  if (value.length > remaining) throw new GmailMimeLimitError("metadata_bytes");
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > remaining)
    throw new GmailMimeLimitError(
      thread && bytes > MIME_PARSE_LIMITS.threadMetadataBytes - thread.metadataBytes
        ? "thread_metadata_bytes"
        : "metadata_bytes",
    );
  budget.metadataBytes += bytes;
  if (thread) thread.metadataBytes += bytes;
}

function walkParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: { plains: string[]; htmls: string[]; attachments: AttachmentMetadata[] },
  budget: ParseBudget,
  depth = 0,
  threadBudget?: ParseBudget,
): void {
  if (!part) {
    return;
  }
  if (depth > MIME_PARSE_LIMITS.depth) throw new GmailMimeLimitError("depth");
  budget.parts += 1;
  if (budget.parts > MIME_PARSE_LIMITS.parts) throw new GmailMimeLimitError("parts");
  if (threadBudget) {
    threadBudget.parts += 1;
    if (threadBudget.parts > MIME_PARSE_LIMITS.threadParts)
      throw new GmailMimeLimitError("thread_parts");
  }
  accountMetadata(part.partId, budget, threadBudget);
  accountMetadata(part.mimeType, budget, threadBudget);
  accountMetadata(part.filename, budget, threadBudget);
  accountMetadata(part.body?.attachmentId, budget, threadBudget);
  for (const header of part.headers ?? []) {
    accountMetadata(header.name, budget, threadBudget);
    accountMetadata(header.value, budget, threadBudget);
  }

  if (part.parts && part.parts.length > 0) {
    for (const child of part.parts) {
      walkParts(child, acc, budget, depth + 1, threadBudget);
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

  if ((TEXT_MIME.test(mimeType) || HTML_MIME.test(mimeType)) && data) {
    const remainingBytes = Math.min(
      MIME_PARSE_LIMITS.decodedBodyBytes - budget.decodedBytes,
      threadBudget
        ? MIME_PARSE_LIMITS.threadDecodedBodyBytes - threadBudget.decodedBytes
        : Number.POSITIVE_INFINITY,
    );
    const decoded = decodeBodyBytes(data, remainingBytes);
    budget.decodedBytes += decoded.length;
    if (threadBudget) threadBudget.decodedBytes += decoded.length;
    (TEXT_MIME.test(mimeType) ? acc.plains : acc.htmls).push(decoded.toString("utf8"));
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
  return parseMessage(message);
}

/** All returned messages remain available within the shared ingestion budget. */
export function parseGmailThread(messages: gmail_v1.Schema$Message[]): ParsedGmailMessage[] {
  if (messages.length > MIME_PARSE_LIMITS.threadMessages)
    throw new GmailMimeLimitError("thread_messages");
  const threadBudget: ParseBudget = {
    decodedBytes: 0,
    parts: 0,
    metadataBytes: 0,
    metadataFields: 0,
  };
  return messages.map((message) => parseMessage(message, threadBudget));
}

function parseMessage(
  message: gmail_v1.Schema$Message,
  threadBudget?: ParseBudget,
): ParsedGmailMessage {
  const payload = message.payload;
  const headers = payload?.headers;
  const acc = {
    plains: [] as string[],
    htmls: [] as string[],
    attachments: [] as AttachmentMetadata[],
  };
  const budget: ParseBudget = { decodedBytes: 0, parts: 0, metadataBytes: 0, metadataFields: 0 };
  accountMetadata(message.id, budget, threadBudget);
  accountMetadata(message.threadId, budget, threadBudget);
  accountMetadata(message.historyId, budget, threadBudget);
  accountMetadata(message.internalDate, budget, threadBudget);
  accountMetadata(message.snippet, budget, threadBudget);
  for (const label of message.labelIds ?? []) accountMetadata(label, budget, threadBudget);
  walkParts(payload, acc, budget, 0, threadBudget);

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
