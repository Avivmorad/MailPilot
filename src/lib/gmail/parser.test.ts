import { describe, expect, it, vi } from "vitest";

import type { gmail_v1 } from "googleapis";

import {
  decodeBase64Url,
  formatAttachmentsForPrompt,
  htmlToText,
  parseGmailMessage,
  parseGmailThread,
  MIME_PARSE_LIMITS,
  GmailMimeLimitError,
} from "@/lib/gmail/parser";

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("decodeBase64Url", () => {
  it("rejects oversized encoding before allocating a decoded buffer", () => {
    const data = "A".repeat(Math.ceil(MIME_PARSE_LIMITS.decodedBodyBytes / 3) * 4 + 1);
    const spy = vi.spyOn(Buffer, "from");
    try {
      expect(() => decodeBase64Url(data)).toThrow(GmailMimeLimitError);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("checks decoded bytes even when encoded length fits the rounding boundary", () => {
    expect(decodeBase64Url(b64("x".repeat(MIME_PARSE_LIMITS.decodedBodyBytes)))).toHaveLength(
      MIME_PARSE_LIMITS.decodedBodyBytes,
    );
    expect(() => decodeBase64Url(b64("x".repeat(MIME_PARSE_LIMITS.decodedBodyBytes + 1)))).toThrow(
      GmailMimeLimitError,
    );
  });

  it("decodes Gmail-style base64url", () => {
    expect(decodeBase64Url(b64("hello world"))).toBe("hello world");
  });
});

describe("htmlToText", () => {
  it("rejects an oversized direct HTML call before case folding or parsing", () => {
    expect(() => htmlToText("x".repeat(MIME_PARSE_LIMITS.decodedBodyBytes + 1))).toThrow(
      GmailMimeLimitError,
    );
  });

  it("does not treat a raw-tag name prefix as its closing tag", () => {
    expect(htmlToText("<script>hidden</scripture>also hidden</script><p>Keep</p>")).toBe("Keep");
  });

  it("does not repeatedly case-fold the whole message for raw-text tags", () => {
    const html = "<StYlE>hidden</sTyLe><p>Useful</p>".repeat(1000);
    const original = String.prototype.toLowerCase;
    let wholeInputCopies = 0;
    const spy = vi.spyOn(String.prototype, "toLowerCase").mockImplementation(function (
      this: string,
    ) {
      if (this.length >= html.length) wholeInputCopies += 1;
      return original.call(this);
    });
    try {
      const result = htmlToText(html);
      expect(result).toContain("Useful");
      expect(result).not.toContain("hidden");
      expect(wholeInputCopies).toBeLessThanOrEqual(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps raw-tag offsets correct after Unicode case-fold expansions", () => {
    const prefix = "İ".repeat(20);
    expect(htmlToText(`${prefix}<SCRIPT>secret</SCRIPT><p>Keep</p>`)).toBe(`${prefix}Keep`);
  });

  it.each([100, 500, 1000])("bounds repeated unclosed raw-tag searches (%s tags)", (count) => {
    const html = "<StYlE>raw".repeat(count) + "<p>Useful</p>";
    const original = String.prototype.indexOf;
    let searchedChars = 0;
    const spy = vi.spyOn(String.prototype, "indexOf").mockImplementation(function (
      this: string,
      needle: string,
      start?: number,
    ) {
      if (needle === "</style") searchedChars += this.length - (start ?? 0);
      return original.call(this, needle, start);
    });
    try {
      expect(htmlToText(html)).toContain("Useful");
      expect(searchedChars).toBeLessThanOrEqual(html.length * 3);
    } finally {
      spy.mockRestore();
    }
  });

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

  it("ignores script blocks with malformed closing tags that browsers still accept", () => {
    const html = '<div>Keep me</div><script>alert(1)</script foo="bar"><p>After</p>';
    expect(htmlToText(html)).toBe("Keep me\nAfter");
  });

  it("does not double-unescape encoded entities", () => {
    expect(htmlToText("&amp;lt;b&amp;gt;safe&amp;lt;/b&amp;gt;")).toBe("&lt;b&gt;safe&lt;/b&gt;");
  });

  it("keeps list items separated when closing tags are omitted", () => {
    expect(htmlToText("<ul><li>one<li>two</ul>")).toBe("one\ntwo");
  });

  it("keeps headings separated when closing tags are omitted", () => {
    expect(htmlToText("<h1>Title<h2>Body</h2>")).toBe("Title\nBody");
  });

  it("recovers body text when a style block is never closed", () => {
    const html =
      '<style type="text/css">.email-body{font-family:Arial}\n<table><tr><td>Payment due tomorrow</td></tr></table>';
    expect(htmlToText(html)).toContain("Payment due tomorrow");
  });

  it("recovers body text when a script block is never closed", () => {
    const html = "<div>Keep</div><script>alert(1)\n<p>After</p>";
    expect(htmlToText(html)).toContain("After");
  });
});

describe("parseGmailMessage", () => {
  it("rejects oversized MIME headers before copying or normalizing their values", () => {
    const subject = "S".repeat(MIME_PARSE_LIMITS.metadataBytes + 1);
    expect(() =>
      parseGmailMessage({ payload: { headers: [{ name: "Subject", value: subject }] } }),
    ).toThrow(GmailMimeLimitError);
  });

  it("bounds many small metadata fields and oversized attachment names", () => {
    const headers = Array.from({ length: MIME_PARSE_LIMITS.metadataFields }, () => ({
      name: "X-Test",
      value: "v",
    }));
    expect(() => parseGmailMessage({ payload: { headers } })).toThrow(GmailMimeLimitError);
    expect(() =>
      parseGmailMessage({
        payload: {
          mimeType: "application/pdf",
          filename: "f".repeat(MIME_PARSE_LIMITS.metadataBytes + 1),
        },
      }),
    ).toThrow(GmailMimeLimitError);
  });

  it("accounts for unused HTML alternatives in the aggregate body budget", () => {
    expect(() =>
      parseGmailMessage({
        payload: {
          parts: [
            { mimeType: "text/plain", body: { data: b64("Useful") } },
            {
              mimeType: "text/html",
              body: { data: b64("x".repeat(MIME_PARSE_LIMITS.decodedBodyBytes)) },
            },
          ],
        },
      }),
    ).toThrow(GmailMimeLimitError);
  });

  it("uses actual multibyte decoded length, not untrusted size metadata", () => {
    const data = b64("שלום".repeat(Math.ceil(MIME_PARSE_LIMITS.decodedBodyBytes / 8) + 1));
    expect(() =>
      parseGmailMessage({ payload: { mimeType: "text/plain", body: { data, size: 1 } } }),
    ).toThrow(GmailMimeLimitError);
  });

  it("bounds deep MIME and cyclic in-memory inputs", () => {
    let part: gmail_v1.Schema$MessagePart = {
      mimeType: "text/plain",
      body: { data: b64("Useful") },
    };
    for (let i = 0; i <= MIME_PARSE_LIMITS.depth; i += 1) part = { parts: [part] };
    expect(() => parseGmailMessage({ payload: part })).toThrow(GmailMimeLimitError);
    const cyclic: gmail_v1.Schema$MessagePart = {};
    cyclic.parts = [cyclic];
    expect(() => parseGmailMessage({ payload: cyclic })).toThrow(GmailMimeLimitError);
  });

  it("accepts the node boundary and rejects one extra MIME part", () => {
    const parts = Array.from({ length: MIME_PARSE_LIMITS.parts - 1 }, () => ({
      mimeType: "text/plain",
      body: { data: b64("Useful") },
    }));
    expect(parseGmailMessage({ payload: { parts } }).plainText).toContain("Useful");
    expect(() => parseGmailMessage({ payload: { parts: [...parts, {}] } })).toThrow(
      GmailMimeLimitError,
    );
  });

  it("still uses HTML when all plain alternatives are whitespace", () => {
    expect(
      parseGmailMessage({
        payload: {
          parts: [
            { mimeType: "text/plain", body: { data: b64("  \n  ") } },
            { mimeType: "TEXT/HTML; charset=utf-8", body: { data: b64("<p>Useful שלום</p>") } },
          ],
        },
      }).plainText,
    ).toBe("Useful שלום");
  });

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

describe("parseGmailThread shared budget", () => {
  it("bounds metadata across individually valid messages", () => {
    const subject = "S".repeat(Math.floor(MIME_PARSE_LIMITS.metadataBytes / 2));
    const message = { payload: { headers: [{ name: "Subject", value: subject }] } };
    const count = Math.floor(MIME_PARSE_LIMITS.threadMetadataBytes / subject.length) + 1;
    expect(() => parseGmailThread(Array.from({ length: count }, () => message))).toThrow(
      GmailMimeLimitError,
    );
  });

  it("preserves every message within the message-count boundary", () => {
    const messages = Array.from({ length: MIME_PARSE_LIMITS.threadMessages }, (_, i) => ({
      id: `m${i}`,
    }));
    expect(parseGmailThread(messages)).toHaveLength(MIME_PARSE_LIMITS.threadMessages);
    expect(() => parseGmailThread([...messages, {}])).toThrow(GmailMimeLimitError);
  });

  it("bounds cumulative bodies across individually valid messages", () => {
    const message = {
      payload: {
        mimeType: "text/plain",
        body: { data: b64("x".repeat(MIME_PARSE_LIMITS.decodedBodyBytes)) },
      },
    };
    const count = MIME_PARSE_LIMITS.threadDecodedBodyBytes / MIME_PARSE_LIMITS.decodedBodyBytes;
    expect(() => parseGmailThread(Array.from({ length: count + 1 }, () => message))).toThrow(
      GmailMimeLimitError,
    );
  });

  it("bounds cumulative MIME nodes across individually valid messages", () => {
    const message = {
      payload: { parts: Array.from({ length: MIME_PARSE_LIMITS.parts - 1 }, () => ({})) },
    };
    const count = MIME_PARSE_LIMITS.threadParts / MIME_PARSE_LIMITS.parts;
    expect(() => parseGmailThread(Array.from({ length: count + 1 }, () => message))).toThrow(
      GmailMimeLimitError,
    );
  });
});
