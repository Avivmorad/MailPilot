import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  goldAnalysisForEvalCase,
  loadEvalCases,
  threadContainsIsoDate,
} from "@/lib/ai/eval-fixtures";
import { threadAnalysisJsonSchema, threadAnalysisSchema } from "@/lib/ai/schemas";

describe("eval fixtures", () => {
  const cases = loadEvalCases();

  it("loads at least 50 representative threads", () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
    const ids = cases.map((evalCase) => evalCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces schema-valid gold analyses for every fixture", () => {
    for (const evalCase of cases) {
      const gold = goldAnalysisForEvalCase(evalCase);
      const parsed = threadAnalysisSchema.safeParse(gold);
      expect(parsed.success, evalCase.id).toBe(true);
      if (parsed.success) {
        expect(parsed.data.deadline).toBe(evalCase.expected.deadline);
      }
    }
  });

  it("does not invent deadlines when the thread has no ISO date", () => {
    for (const evalCase of cases) {
      if (!threadContainsIsoDate(evalCase)) {
        expect(evalCase.expected.deadline, evalCase.id).toBeNull();
      }
    }
  });

  it("keeps an explicit ISO deadline only when present in the thread", () => {
    const dated = cases.find((evalCase) => evalCase.id === "case_039_tax_document_iso_deadline");
    expect(dated?.expected.deadline).toBe("2026-09-18");
    expect(dated && threadContainsIsoDate(dated)).toBe(true);
  });

  it("includes a prompt-injection fixture that still requires a real reply", () => {
    const injection = cases.find((evalCase) => evalCase.id === "case_027_prompt_injection");
    expect(injection?.expected.status).toBe("action_required");
    expect(injection?.expected.action_type).toBe("reply");
    expect(injection?.expected.deadline).toBeNull();
    expect(injection?.messages[0]?.body).toMatch(/Ignore previous instructions/i);
  });

  it("covers English, Hebrew, and mixed T3 scenario families", () => {
    const byId = new Set(cases.map((evalCase) => evalCase.id));
    const requiredIds = [
      "case_002_invoice_to_pay",
      "case_003_payment_confirmation",
      "case_052_hebrew_unpaid_invoice",
      "case_053_hebrew_paid_receipt",
      "case_054_otp_english",
      "case_055_hebrew_otp",
      "case_056_account_locked",
      "case_016_job_interview",
      "case_057_job_application_receipt",
      "case_058_hebrew_assessment",
      "case_059_out_of_office_waiting",
      "case_060_hebrew_ticket_ack",
      "case_061_user_reply_then_new_inbound",
      "case_019_calendar_invite",
      "case_062_confirmed_meeting_moved",
      "case_063_hebrew_pick_meeting_time",
      "case_014_shipping_notification",
      "case_064_parcel_collection",
      "case_065_hebrew_customs",
      "case_066_relative_deadline_next_friday",
      "case_067_mixed_ambiguous_relative_date",
      "case_049_long_thread_thanks",
      "case_068_forwarded_hebrew_review",
      "case_069_docusign_automated_sign",
      "case_071_automated_comment_action",
      "case_027_prompt_injection",
      "case_070_hebrew_prompt_injection",
    ];
    for (const id of requiredIds) {
      expect(byId.has(id), id).toBe(true);
    }

    const hebrewOrMixed = cases.filter((evalCase) =>
      /[\u0590-\u05FF]/.test(
        evalCase.messages.map((message) => `${message.subject}\n${message.body}`).join("\n"),
      ),
    );
    expect(hebrewOrMixed.length).toBeGreaterThanOrEqual(10);
  });
});

describe("threadAnalysisJsonSchema", () => {
  it("lists every property as required for Gemini structured output", () => {
    expect(threadAnalysisJsonSchema.additionalProperties).toBe(false);
    expect(threadAnalysisJsonSchema.required).toEqual(
      expect.arrayContaining(["summary", "deadline", "short_display_title"]),
    );
    expect(threadAnalysisJsonSchema.required).toHaveLength(
      Object.keys(threadAnalysisJsonSchema.properties).length,
    );
  });
});

describe("AI module isolation", () => {
  it("does not import Gmail label mutation APIs", () => {
    const dir = path.join(process.cwd(), "src/lib/ai");
    const files = readdirSync(dir).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    for (const name of files) {
      const source = readFileSync(path.join(dir, name), "utf8");
      expect(source, name).not.toMatch(/@\/lib\/gmail\/labels/);
    }
  });
});
