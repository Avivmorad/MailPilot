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
