import { describe, expect, it } from "vitest";

import {
  getContextLimits,
  isGmailConfigured,
  parseClientEnv,
  parseGmailEnv,
  parseServerEnv,
} from "@/lib/config/env";

describe("parseGmailEnv", () => {
  it("succeeds without OpenAI or cron secrets", () => {
    const env = parseGmailEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:3000/api/gmail/callback",
      TOKEN_ENCRYPTION_KEY: "0".repeat(64),
    });

    expect(env.GOOGLE_CLIENT_ID).toBe("client-id");
  });

  it("throws when Google secrets are missing", () => {
    expect(() =>
      parseGmailEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toThrowError(/Gmail OAuth/);
  });
});

describe("isGmailConfigured", () => {
  it("is false when Google keys are empty", () => {
    expect(isGmailConfigured({})).toBe(false);
  });
});

const validServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://app.example.com/api/gmail/callback",
  TOKEN_ENCRYPTION_KEY: "0".repeat(64),
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-test",
  CRON_SECRET: "cron-secret",
};

describe("parseServerEnv", () => {
  it("applies numeric defaults and coerces provided numbers", () => {
    const env = parseServerEnv(validServerEnv);

    expect(env.MAX_THREAD_MESSAGES).toBe(6);
    expect(env.MAX_MESSAGE_CHARS).toBe(12000);
    expect(env.MAX_THREAD_CHARS).toBe(35000);
    expect(env.AI_MAX_CONCURRENCY).toBe(5);
  });

  it("coerces string numbers from the environment", () => {
    const env = parseServerEnv({ ...validServerEnv, AI_MAX_CONCURRENCY: "12" });

    expect(env.AI_MAX_CONCURRENCY).toBe(12);
  });

  it("throws a descriptive error when required secrets are missing", () => {
    expect(() => parseServerEnv({})).toThrowError(/environment variables/i);
  });

  it("rejects non-positive numeric config", () => {
    expect(() => parseServerEnv({ ...validServerEnv, AI_MAX_CONCURRENCY: "0" })).toThrowError();
  });
});

describe("parseClientEnv", () => {
  it("accepts valid public variables", () => {
    const env = parseClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("throws when a public variable is missing", () => {
    expect(() =>
      parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
    ).toThrowError();
  });
});

describe("getContextLimits", () => {
  it("uses spec defaults when unset", () => {
    const limits = getContextLimits({});
    expect(limits.MAX_THREAD_MESSAGES).toBe(6);
    expect(limits.MAX_MESSAGE_CHARS).toBe(12000);
    expect(limits.MAX_THREAD_CHARS).toBe(35000);
  });
});
