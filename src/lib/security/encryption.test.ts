import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  parseEncryptionKey,
  timingSafeStringEqual,
} from "@/lib/security/encryption";

const HEX_KEY = "ab".repeat(32);

describe("parseEncryptionKey", () => {
  it("accepts 64-char hex", () => {
    expect(parseEncryptionKey(HEX_KEY)).toHaveLength(32);
  });

  it("rejects short keys", () => {
    expect(() => parseEncryptionKey("too-short")).toThrowError(/32-byte/);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a refresh token", () => {
    const token = "1//refresh-token-example";
    const encrypted = encryptSecret(token, HEX_KEY);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(token);
    expect(decryptSecret(encrypted, HEX_KEY)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const first = encryptSecret("same", HEX_KEY);
    const second = encryptSecret("same", HEX_KEY);
    expect(first).not.toBe(second);
    expect(decryptSecret(first, HEX_KEY)).toBe("same");
    expect(decryptSecret(second, HEX_KEY)).toBe("same");
  });

  it("fails to decrypt with a different key", () => {
    const encrypted = encryptSecret("secret", HEX_KEY);
    expect(() => decryptSecret(encrypted, "cd".repeat(32))).toThrowError();
  });

  it("rejects a malformed envelope", () => {
    expect(() => decryptSecret("not-valid", HEX_KEY)).toThrowError(/Unsupported/);
  });
});

describe("timingSafeStringEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeStringEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeStringEqual("short", "longer")).toBe(false);
  });
});
