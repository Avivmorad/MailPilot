import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Decode TOKEN_ENCRYPTION_KEY into a 32-byte AES key.
 * Accepts 64-char hex (`openssl rand -hex 32`) or 32-byte base64.
 */
export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const asBase64 = Buffer.from(trimmed, "base64");
  if (asBase64.length === KEY_LENGTH) {
    return asBase64;
  }
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must be a 32-byte key (64-char hex from `openssl rand -hex 32`, or base64)",
  );
}

/**
 * Encrypt a secret with AES-256-GCM.
 * Stored format: `v1:<iv>:<authTag>:<ciphertext>` (base64url parts).
 */
export function encryptSecret(value: string, keyMaterial: string): string {
  const key = parseEncryptionKey(keyMaterial);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string, keyMaterial: string): string {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unsupported encrypted secret format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = parseEncryptionKey(keyMaterial);
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(dataB64, "base64url");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted secret envelope");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export type UnwrapSecretResult = {
  plaintext: string;
  usedPreviousKey: boolean;
};

/**
 * Decrypt with the current key, then the optional previous key used during rotation.
 */
export function unwrapSecretWithRotation(
  value: string,
  currentKey: string,
  previousKey?: string,
): UnwrapSecretResult {
  try {
    return { plaintext: decryptSecret(value, currentKey), usedPreviousKey: false };
  } catch (currentError) {
    const previous = previousKey?.trim();
    if (!previous || previous === currentKey) {
      throw currentError;
    }
    return { plaintext: decryptSecret(value, previous), usedPreviousKey: true };
  }
}

/**
 * If the ciphertext was produced with the previous key, return a new envelope
 * under the current key so later reads do not need the old key.
 */
export function rotateSecretEnvelope(
  value: string,
  currentKey: string,
  previousKey?: string,
): { plaintext: string; rotatedCiphertext: string | null } {
  const unwrapped = unwrapSecretWithRotation(value, currentKey, previousKey);
  if (!unwrapped.usedPreviousKey) {
    return { plaintext: unwrapped.plaintext, rotatedCiphertext: null };
  }
  return {
    plaintext: unwrapped.plaintext,
    rotatedCiphertext: encryptSecret(unwrapped.plaintext, currentKey),
  };
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
