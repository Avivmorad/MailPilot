import { assertThreadAnalysisInvariants, postProcessThreadAnalysis } from "@/lib/ai/post-process";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";

export type { ThreadAnalysisInput } from "@/lib/ai/types";
export { threadAnalysisInputFromContext } from "@/lib/ai/types";

export interface EmailTriageProvider {
  analyzeThread(input: ThreadAnalysisInput): Promise<ThreadAnalysis>;
}

export class ThreadTriageError extends Error {
  constructor(
    readonly code: "schema" | "provider" | "invariants",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ThreadTriageError";
  }
}

export type TriageOutcome =
  | { ok: true; analysis: ThreadAnalysis }
  | { ok: false; error: Error };

/**
 * Validate, post-process, and enforce invariants. Gmail labels must only be
 * applied by a later scan step after this returns successfully (spec §68.8).
 */
export async function analyzeThread(
  input: ThreadAnalysisInput,
  provider: EmailTriageProvider,
): Promise<ThreadAnalysis> {
  let raw: ThreadAnalysis;
  try {
    raw = await provider.analyzeThread(input);
  } catch (error) {
    throw new ThreadTriageError("provider", "Email triage provider failed", error);
  }

  const parsed = threadAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ThreadTriageError("schema", "AI output failed schema validation", parsed.error);
  }

  let processed: ThreadAnalysis;
  try {
    processed = postProcessThreadAnalysis(parsed.data, {
      latestFrom: input.latestFrom,
      latestSubject: input.latestSubject,
      threadText: input.threadText,
      preferences: input.preferences,
    });
    assertThreadAnalysisInvariants(processed);
  } catch (error) {
    throw new ThreadTriageError("invariants", "AI output failed invariant validation", error);
  }

  return processed;
}

/**
 * Scan-safe wrapper: a failed AI call never yields an analysis, so callers
 * must not apply Gmail labels unless `ok` is true.
 */
export async function tryAnalyzeThread(
  input: ThreadAnalysisInput,
  provider: EmailTriageProvider,
): Promise<TriageOutcome> {
  try {
    const analysis = await analyzeThread(input, provider);
    return { ok: true, analysis };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error("triage failed") };
  }
}

export async function analyzeThenApplyLabels(
  input: ThreadAnalysisInput,
  provider: EmailTriageProvider,
  applyGmailLabels: (analysis: ThreadAnalysis) => Promise<void>,
): Promise<TriageOutcome> {
  const outcome = await tryAnalyzeThread(input, provider);
  if (outcome.ok) {
    await applyGmailLabels(outcome.analysis);
  }
  return outcome;
}
