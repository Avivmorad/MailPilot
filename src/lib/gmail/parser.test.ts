import { describe, expect, it } from "vitest";

import type { gmail_v1 } from "googleapis";

import {
  decodeBase64Url,
  formatAttachmentsForPrompt,
  htmlToText,
  parseGmailMessage,
} from "@/lib/gmail/parser";

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("decodeBase64Url", () => {
  it("decodes Gmail-style base64url", () => {
    expect(decodeBase64Url(b64("hello world"))).toBe("hello world");
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts, and images", () => {
    const html = `
      <html><head><style>.x{color:red}</style></head>
      <body>
        <script>alert(1)</script>
        <p>Hello <b>Daniel</b></p>
        <img src="http://tracker/pixel.gif" />
      </body></html>
    `;
    const text = htmlToText(html);
    expect(text).toContain("Hello Daniel");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("tracker");
    expect(text).not.toContain("<p>");
  });
});

describe("parseGmailMessage", () => {
  it("prefers text/plain", () => {
    const message: gmail_v1.Schema$Message = {
      id: "m1",
      threadId: "t1",
      snippet: "Hello",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "Ada <ada@example.com>" },
          { name: "To", value: "me@example.com" },
          { name: "Subject", value: "Hi" },
        ],
        body: { data: b64("Plain body") },
      },
    };

    const parsed = parseGmailMessage(message);
    expect(parsed.plainText).toBe("Plain body");
    expect(parsed.from).toContain("ada@example.com");
    expect(parsed.subject).toBe("Hi");
    expect(parsed.hasAttachments).toBe(false);
  });

  it("falls back from HTML-only email", () => {
    const message: gmail_v1.Schema$Message = {
      id: "m2",
      threadId: "t1",
      payload: {
        mimeType: "text/html",
        headers: [{ name: "Subject", value: "HTML only" }],
        body: { data: b64("<p>Invoice <b>due</b> tomorrow</p>") },
      },
    };

    expect(parseGmailMessage(message).plainText).toBe("Invoice due tomorrow");
  });

  it("handles multipart/alternative and prefers plain", () => {
    const message: gmail_v1.Schema$Message = {
      id: "m3",
      threadId: "t1",
      payload: {
        mimeType: "multipart/alternative",
        headers: [{ name: "Subject", value: "Multipart" }],
        parts: [
          { mimeType: "text/plain", body: { data: b64("Choose courses") } },
          { mimeType: "text/html", body: { data: b64("<p>Choose <i>courses</i></p>") } },
        ],
      },
    };

    expect(parseGmailMessage(message).plainText).toBe("Choose courses");
  });

  it("keeps attachment metadata and ignores binary content", () => {
    const secretBytes = b64("THIS-IS-BINARY-PDF-CONTENT");
    const message: gmail_v1.Schema$Message = {
      id: "m4",
      threadId: "t1",
      payload: {
        mimeType: "multipart/mixed",
        headers: [{ name: "Subject", value: "Invoice attached" }],
        parts: [
          { mimeType: "text/plain", body: { data: b64("See attached invoice.") } },
          {
            filename: "invoice.pdf",
            mimeType: "application/pdf",
            body: { attachmentId: "att1", size: 123456, data: secretBytes },
          },
        ],
      },
    };

    const parsed = parseGmailMessage(message);
    expect(parsed.plainText).toBe("See attached invoice.");
    expect(parsed.hasAttachments).toBe(true);
    expect(parsed.attachments).toEqual([
      { filename: "invoice.pdf", mimeType: "application/pdf", size: 123456 },
    ]);
    expect(JSON.stringify(parsed)).not.toContain("THIS-IS-BINARY-PDF-CONTENT");
    expect(formatAttachmentsForPrompt(parsed.attachments)).toContain(
      "invoice.pdf (application/pdf)",
    );
    expect(formatAttachmentsForPrompt(parsed.attachments)).toContain("were not analyzed");
  });

  it("handles Hebrew HTML", () => {
    const message: gmail_v1.Schema$Message = {
      id: "m5",
      threadId: "t1",
      payload: {
        mimeType: "text/html",
        body: { data: b64("<p>שלום, נא לאשר עד מחר</p>") },
      },
    };
    expect(parseGmailMessage(message).plainText).toContain("שלום");
  });
});
